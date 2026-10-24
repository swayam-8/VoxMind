import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, CheckCircle2, Code2, Download, KeyRound, LockKeyhole, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiCodeExamples } from "../components/api-code-examples";
import { apiClient, API_BASE } from "@/lib/api-client";

type Operation = { summary: string; description: string };
type Reference = { paths: Record<string, Record<string, Operation>> };
const providers = [
  { id: "zoom", name: "Zoom", requirement: "A Zoom account with cloud recording enabled. Local recordings on your computer must be uploaded manually.", permissions: "Read recording lists, recording files, and download recordings.", console: "https://marketplace.zoom.us/", scope: "cloud_recording:read:list_user_recordings cloud_recording:read:list_recording_files cloud_recording:read:download_recording", prefix: "ZOOM" },
  { id: "google-meet", name: "Google Meet", requirement: "A Google Workspace plan that supports Meet recording. Sign in to the Google account that can access the recording in Drive.", permissions: "Read-only access to Google Drive. MeetingBrief lists the Meet Recordings folder by default; you choose which recordings to import.", console: "https://console.cloud.google.com/", scope: "https://www.googleapis.com/auth/drive.readonly", prefix: "GOOGLE" },
  { id: "webex", name: "Webex", requirement: "A Webex account with completed cloud recordings and permission to download them.", permissions: "Read your meeting recordings.", console: "https://developer.webex.com/my-apps", scope: "meeting:recordings_read", prefix: "WEBEX" },
];
export function DocumentationPage() {
  const base = new URL(API_BASE, window.location.origin).href.replace(/\/$/, "");
  const local = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const callbackBase = local ? `${window.location.protocol}//${window.location.hostname}:5000` : window.location.origin;
  const reference = useQuery<Reference>({ queryKey: ["public-api-reference"], queryFn: () => apiClient.getApiReference(), staleTime: 60000 });
  const json = JSON.stringify({ success: true, data: { id: "your-recording-id", status: "queued", title: "Project review" } }, null, 2);
  return <div className="feature-page documentation-page space-y-8">
    <div className="docs-heading">
      <span className="eyebrow">VOXMIND GUIDES</span>
      <h1>Connect your tools.<br />Build your own workflow.</h1>
      <p>Everything you need to connect meeting accounts or use the API, right here.</p>
      <Link to="/app/api" className="text-link">Manage integrations <ArrowRight size={18} /></Link>
    </div>
    <nav className="docs-nav" aria-label="Guide contents">
      <a href="#api"><Code2 /> API quickstart</a><a href="#reference"><BookOpen /> Endpoint reference</a><a href="#meetings"><Video /> Meeting accounts</a><a href="#security"><LockKeyhole /> Key safety</a>
    </nav>
    <section id="api" className="docs-section">
      <div className="docs-section-heading"><span className="panel-icon"><Code2 /></span><div><h2>From audio to structured results</h2><p>Use MeetingBrief from your server, automation, or internal tools.</p></div></div>
      <ol className="docs-steps">
        <li><span>01</span><div><h3>Create a key</h3><p>Open <Link to="/app/api">Integrations</Link>, choose Generate API Key, and select read and write access for uploads. Choose an expiry and save the key once. Only workspace owners and administrators manage keys.</p></div></li>
        <li><span>02</span><div><h3>Upload a recording</h3><p>Send multipart form data with a file and optional title. The API returns HTTP 201 with a recording ID and queued status. A read-only key can retrieve existing recordings and ask questions.</p></div></li>
        <li><span>03</span><div><h3>Check processing</h3><p>Call GET /recordings/&#123;id&#125; every 3–5 seconds. Wait for status to become completed for the transcript, then analysis_status to become completed for insights. Stop and inspect the error if either stage fails.</p></div></li>
        <li><span>04</span><div><h3>Use the results</h3><p>Retrieve timestamped transcript segments, summary, key takeaways, decisions, and assigned actions. Ask questions to receive an answer with a transcript support flag and evidence timestamps.</p></div></li>
      </ol>
      <div className="docs-api-base"><span>API base URL</span><code>{base}</code></div>
      <ApiCodeExamples />
      <h3 className="docs-subheading">Example upload response</h3><pre className="api-example-code"><code>{json}</code></pre>
      <p className="docs-callout">An accepted upload is not a finished transcript. Processing time depends on recording length and service capacity. Never treat queued status as a completed result.</p>
    </section>
    <section id="reference" className="docs-section">
      <div className="docs-section-heading"><span className="panel-icon"><BookOpen /></span><div><h2>API endpoint reference</h2><p>Workspace access and permissions are enforced on every request.</p></div></div>
      <a className="text-link" href={`${base}/openapi.json`} download="meetingbrief-openapi.json"><Download size={18} /> Download OpenAPI specification</a>
      {reference.isLoading && <p role="status">Loading API reference…</p>}
      {reference.isError && <div role="alert"><p>Could not load the API reference.</p><Button variant="outline" onClick={() => reference.refetch()}>Reload reference</Button></div>}
      <div className="api-endpoint-list">{Object.entries(reference.data?.paths || {}).flatMap(([path, methods]) => Object.entries(methods).filter(([method]) => ["get", "post", "patch", "put", "delete"].includes(method)).map(([method, operation]) => (
        <details key={`${method}:${path}`} className="api-endpoint">
          <summary><span className={`api-method method-${method}`}>{method.toUpperCase()}</span><code>{path}</code><span>{operation.summary}</span></summary>
          <p>{operation.description}</p>
        </details>
      )))}</div>
      <h3 className="docs-subheading">Errors and request limits</h3>
      <dl className="docs-errors"><div><dt>400 / 413</dt><dd>Invalid fields, unsupported media, or a request larger than the configured limit.</dd></div><div><dt>401 / 403</dt><dd>Missing, expired, or revoked credentials; insufficient key permissions or workspace access.</dd></div><div><dt>404</dt><dd>The resource does not exist in your workspace, or analysis is not available yet.</dd></div><div><dt>429</dt><dd>Read Retry-After and wait before retrying. Do not loop immediately.</dd></div><div><dt>503</dt><dd>A required service is unavailable. Back off and retry; avoid repeating uploads without checking the previous result.</dd></div></dl>
      <p className="docs-callout">Default limits: 300 API requests per minute per IP, 20 AI/search requests per minute per workspace, and 10 uploads per hour per workspace. Usage reports show recorded activity; billing plans and paid quotas are not enabled yet.</p>
    </section>
    <section id="meetings" className="docs-section">
      <div className="docs-section-heading"><span className="panel-icon"><Video /></span><div><h2>Connect a meeting account</h2><p>Sign in with the provider. Choose a recording. We handle the import.</p></div></div>
      <ol className="docs-steps">
        <li><span>01</span><div><h3>Connect</h3><p>Open Integrations and select Connect next to Zoom, Google Meet, or Webex. You will be taken to the provider’s own authorization page. MeetingBrief never asks for your provider password.</p></div></li>
        <li><span>02</span><div><h3>Authorize</h3><p>Review the requested access and approve. Return to MeetingBrief in the same browser. If you cancel, you can start again. Customers do not need to register OAuth apps or enter client secrets.</p></div></li>
        <li><span>03</span><div><h3>Select and import</h3><p>Choose Browse recordings, select a completed recording, and click Import recording. Progress appears under Recent meeting imports. Select Open when ready to view transcription and insights.</p></div></li>
      </ol>
      <div className="docs-provider-grid">{providers.map((provider) => <article key={provider.id}><h3>{provider.name}</h3><p>{provider.requirement}</p><h4>Requested access</h4><p>{provider.permissions}</p></article>)}</div>
      <details className="docs-faq"><summary>I cannot see my recording</summary><p>Wait for the provider to finish processing it. Check that you signed in to the account that owns or can download it. Zoom lists the last 30 days. Meet looks for the Meet Recordings folder in Drive; use the alternate-folder option if it was moved. Some plans or organization policies do not allow recording downloads.</p></details>
      <details className="docs-faq"><summary>My connection expired or an import failed</summary><p>Choose Reconnect account and approve access again. Failed imports can be retried from Recent meeting imports. If a recording exceeds the displayed size limit, download it from the provider and prepare a smaller supported file before uploading.</p></details>
      <details className="docs-faq"><summary>How do I disconnect?</summary><p>Use the disconnect button beside the provider. This removes its saved credentials from MeetingBrief; recordings already imported stay in your library until you delete them. You can also revoke MeetingBrief’s access in the provider’s account security settings.</p></details>
      <p className="docs-callout">Connecting does not start a meeting or record participants. Import only recordings you are authorized to process, and get any required participant consent.</p>
      <details className="docs-faq"><summary>For the service operator: enable Google sign-in</summary><p>Create a Google OAuth web application with openid, email, and profile scopes. Set GOOGLE_AUTH_CLIENT_ID and GOOGLE_AUTH_CLIENT_SECRET in your server secret manager, or reuse the Google client credentials configured for meeting imports. Add this redirect URL to the Google application:</p><div className="operator-provider"><code>{callbackBase}/api/v1/auth/google/callback</code></div><p>Set AUTH_API_BASE_URL and FRONTEND_URL to your deployed HTTPS origin, then restart the backend. Sign-in never requests Drive access; customers authorize meeting imports separately. Existing password accounts connect Google in Settings after confirming their password.</p></details>
      <details className="docs-faq docs-operator"><summary>For the service operator: enable providers once</summary>
        <p>Before public launch, register provider OAuth applications under your business. Configure their client IDs and secrets in your deployment’s secret manager, set FRONTEND_URL and INTEGRATIONS_API_BASE_URL to your public HTTPS origin, and keep INTEGRATION_ENCRYPTION_KEY stable. The local launcher generates encryption and internal service keys automatically. Never collect client secrets from customers.</p>
        {providers.map((provider) => <div key={provider.id} className="operator-provider"><h3>{provider.name}</h3><a href={provider.console} target="_blank" rel="noreferrer">Open official developer console</a><p>Set {provider.prefix}_CLIENT_ID and {provider.prefix}_CLIENT_SECRET on the server.</p><p>Allow this redirect URL:</p><code>{callbackBase}/api/v1/meeting-integrations/{provider.id}/callback</code><p>Required scopes:</p><code>{provider.scope}</code></div>)}
        <p>For Google, enable the Drive API and configure the consent screen; external production access may require Google verification. Publish or distribute Zoom and Webex apps as their policies require. Configure provider privacy and deletion URLs on your product domain. Restart the backend after saving secrets, then test with authorized accounts before enabling the integration for customers.</p>
      </details>
    </section>
    <section id="security" className="docs-section">
      <div className="docs-section-heading"><span className="panel-icon"><KeyRound /></span><div><h2>Keep your keys private</h2><p>Give each integration only the access it needs.</p></div></div>
      <ul className="docs-safety-list">{["Keep API keys in server environment variables or a secret manager. Never embed them in a browser or mobile application.", "Use a read-only key for retrieval and questions. Use a separate read/write key when uploads or changes are necessary.", "Send keys in Authorization: Bearer headers or X-API-Key. Full API keys and login tokens are rejected in URL query strings.", "Keys expire after 90 days by default; choose a shorter expiry when possible. Revoke unused or exposed keys immediately.", "Use HTTPS for the deployed service. Changing your password invalidates previous sessions and revokes your API keys."].map((item) => <li key={item}><CheckCircle2 aria-hidden="true" /><p>{item}</p></li>)}</ul>
    </section>
  </div>;
}
