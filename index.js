//index.js
const core = require("@actions/core");
const exec = require("@actions/exec");
const { exit } = require("process");
const process = require("process");
const fs = require("fs");
const os = require("os");
const path = require("path");

async function run() {

    const step = core.getInput("step");
    const archivistaServer = core.getInput("archivista-server");
    const attestations = core.getInput("attestations").split(" ");
    const certificate = core.getInput("certificate");
    const enableArchivista = core.getInput("enable-archivista") === "true";
    let fulcio = core.getInput("fulcio");
    let fulcioOidcClientId = core.getInput("fulcio-oidc-client-id");
    let fulcioOidcIssuer = core.getInput("fulcio-oidc-issuer");
    const fulcioToken = core.getInput("fulcio-token");
    const intermediates = core.getInput("intermediates").split(" ");
    const key = core.getInput("key");
    let outfile = core.getInput("outfile")
    outfile = outfile ? outfile : path.join(os.tmpdir(), step + "-attestation.json");
    const productExcludeGlob = core.getInput("product-exclude-glob");
    const productIncludeGlob = core.getInput("product-include-glob");
    const spiffeSocket = core.getInput("spiffe-socket");

    let timestampServers = core.getInput("timestamp-servers")
    const trace = core.getInput("trace");
    const workingdir = core.getInput("workingdir");
    const enableSigstore = core.getInput("enable-sigstore") === "true";
    const command = core.getInput("command");


    const cmd = ["witness run"];



    cmd.push("--archivista-server", archivistaServer);
    if (enableSigstore) {
        fulcio = fulcio || "https://v1.fulcio.sigstore.dev";
        fulcioOidcClientId = fulcioOidcClientId || "https://oauth2.sigstore.dev/auth";
        fulcioOidcIssuer = fulcioOidcIssuer || "sigstore";
        timestampServers = "https://freetsa.org/tsr " + timestampServers
    }
    if (attestations.length) {
        attestations.forEach((attestation) => {
            // Trim leading and trailing spaces from the attestation value
            attestation = attestation.trim();
            // Skip empty attestation values
            if (attestation.length > 0) {
                // Use "--attestation" as a separate argument and push the value separately
                cmd.push("-a");
                cmd.push(attestation);
            }
        });
    }
    if (certificate) cmd.push("--certificate", certificate);
    if (enableArchivista) cmd.push("--enable-archivista", enableArchivista);
    if (fulcio) cmd.push("--fulcio", fulcio);
    if (fulcioOidcClientId) cmd.push("--fulcio-oidc-client-id", fulcioOidcClientId);
    if (fulcioOidcIssuer) cmd.push("--fulcio-oidc-issuer", fulcioOidcIssuer);
    if (fulcioToken) cmd.push("--fulcio-token", fulcioToken);
    if (intermediates.length) {
        intermediates.forEach((intermediate) => {
            // Trim leading and trailing spaces from the intermediate value
            intermediate = intermediate.trim();
            // Skip empty intermediate values
            if (intermediate.length > 0) {
                // Use "-i" as a separate argument and push the value separately
                cmd.push("-i");
                cmd.push(intermediate);
            }
        });
    }
    if (key) cmd.push("--key", key);

    if (productExcludeGlob) cmd.push("--product-excludeGlob", productExcludeGlob);
    if (productIncludeGlob) cmd.push("--product-includeGlob", productIncludeGlob);
    if (spiffeSocket) cmd.push("--spiffe-socket", spiffeSocket);
    if (step) cmd.push("-s", step);
    if (timestampServers) {
        // Split the timestampServers string by space to get an array of values
        const timestampServerValues = timestampServers.split(" ");
        timestampServerValues.forEach((timestampServer) => {
            // Trim leading and trailing spaces from the timestampServer value
            timestampServer = timestampServer.trim();
            // Skip empty timestampServer values
            if (timestampServer.length > 0) {
                // Use "--timestamp-servers" as a separate argument and push the value separately
                cmd.push("--timestamp-servers");
                cmd.push(timestampServer);
            }
        });
    }
    if (trace) cmd.push("--trace", trace);

    cmd.push("--outfile", outfile);

    cmd.push("--", command);

    const cmdJoined = cmd.join(" ");
    core.info("Running command: " + cmdJoined);

    // Change working directory to the root of the repo
    process.chdir(process.env.GITHUB_WORKSPACE);

    // Execute the command and capture its output
    let output = "";
    await exec.exec("./" + cmdJoined, [], {
        listeners: {
            stdout: (data) => {
                output += data.toString();
            },
            stderr: (data) => {
                output += data.toString();
            },
        },
    });

    // Find the Git OID using regex
    const match = output.match(/[0-9a-fA-F]{64}/);
    if (!match) {
        console.error('Failed to extract Git OID from the output');
        process.exit(1);
    }

    const gitOID = match[0];
    console.log('Extracted Git OID:', gitOID);

    // Print the Git OID to the output
    core.setOutput("git_oid", gitOID);

    // Construct the artifact URL using Archivista server and Git OID
    const artifactURL = `${archivistaServer}/download/${gitOID}`;

    // Add Job Summary with Markdown content
    const summaryHeader = `
## Attestations Created
| Step | Attestors Run | Attentation OID
| --- | --- | --- |
`;

    // Read the contents of the file
    const summaryFile = fs.readFileSync(process.env.GITHUB_STEP_SUMMARY, { encoding: "utf-8" });

    // Check if the file contains the header
    const headerExists = summaryFile.includes(summaryHeader.trim());

    // If the header does not exist, append it to the file
    if (!headerExists) {
        fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryHeader);
    }

    // Construct the table row for the current step
    const tableRow = `| ${step} | ${attestations.join(', ')} | [${gitOID}](${artifactURL}) |\n`;


    // Append the table row to the file
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, tableRow);

    exit(0);

}



run();