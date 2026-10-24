import { API_BASE } from "@/lib/api-client";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";

export function ApiCodeExamples() {
  const base = new URL(API_BASE, window.location.origin).href.replace(/\/$/, "");
  const examples = {
    curl: `# Run on your server. Set MEETINGBRIEF_API_KEY to a read/write key.\ncurl "${base}/recordings" \\\n  -H "Authorization: Bearer $MEETINGBRIEF_API_KEY" \\\n  -F "file=@meeting.mp3" \\\n  -F "title=Project review"`,
    powershell: `$headers = @{ Authorization = "Bearer $env:MEETINGBRIEF_API_KEY" }\nInvoke-RestMethod -Uri "${base}/recordings" -Headers $headers\n\n# For uploads, use curl.exe so PowerShell does not substitute its curl alias:\ncurl.exe "${base}/recordings" -H "Authorization: Bearer $env:MEETINGBRIEF_API_KEY" -F "file=@meeting.mp3"`,
    node: `// Node.js 22+, server-side only. No SDK installation required.\nimport { readFile } from "node:fs/promises";\n\nconst form = new FormData();\nform.append("file", new Blob([await readFile("meeting.mp3")]), "meeting.mp3");\nform.append("title", "Project review");\nconst response = await fetch("${base}/recordings", {\n  method: "POST",\n  headers: { Authorization: \`Bearer \${process.env.MEETINGBRIEF_API_KEY}\` },\n  body: form,\n});\nconst result = await response.json();\nif (!response.ok) throw new Error(result.message);\nconsole.log(result.data.id); // Poll GET /recordings/{id} for results.`,
    python: `# pip install requests — run on your server.\nimport os\nimport requests\n\nheaders = {"Authorization": f"Bearer {os.environ['MEETINGBRIEF_API_KEY']}"}\nwith open("meeting.mp3", "rb") as audio:\n    response = requests.post(\n        "${base}/recordings",\n        headers=headers,\n        files={"file": ("meeting.mp3", audio, "audio/mpeg")},\n        data={"title": "Project review"},\n        timeout=120,\n    )\nresponse.raise_for_status()\nprint(response.json()["data"]["id"])`,
  };
  return <Tabs defaultValue="curl" className="api-code-examples">
    <TabsList aria-label="Example language" className="grid grid-cols-2 sm:grid-cols-4 w-full">
      <TabsTrigger value="curl">cURL</TabsTrigger><TabsTrigger value="powershell">PowerShell</TabsTrigger>
      <TabsTrigger value="node">Node.js</TabsTrigger><TabsTrigger value="python">Python</TabsTrigger>
    </TabsList>
    {Object.entries(examples).map(([language, code]) => <TabsContent value={language} key={language}>
      <div className="api-code-toolbar"><span>Use your own MEETINGBRIEF_API_KEY environment variable</span><Button size="sm" variant="outline" onClick={() => {
        void navigator.clipboard.writeText(code).then(() => toast({ title: "Example copied" })).catch(() => toast({ title: "Select and copy the example below", variant: "danger" }));
      }}><Copy aria-hidden="true" /> Copy example</Button></div>
      <pre className="api-example-code"><code>{code}</code></pre>
    </TabsContent>)}
  </Tabs>;
}
