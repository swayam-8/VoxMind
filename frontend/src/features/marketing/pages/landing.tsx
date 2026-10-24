import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AudioLines, ArrowRight, ArrowUpRight, Check, CheckCheck, ChevronDown, Code2, FileText, ListChecks, LockKeyhole, Menu, MessageSquare, Play, Sparkles, Target, Upload, Video, X } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Waveform } from "@/components/brand/waveform";

const features = [
  { icon: FileText, number: "01", title: "The conversation, captured.", text: "Turn a recording into a searchable transcript with speaker labels and timestamps. Find the exact moment without replaying the whole meeting." },
  { icon: Target, number: "02", title: "Decisions with direction.", text: "Read a clear summary, review decisions, and track the actions that follow. Keep the context behind each commitment." },
  { icon: MessageSquare, number: "03", title: "Ask. Find. Follow through.", text: "Ask a question about a recording, review the supporting moments, and keep your questions and answers together for later." },
];
export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    document.title = "MeetingBrief — Meeting notes. Clear next steps.";
    if (!menuOpen) return;
    document.querySelector<HTMLAnchorElement>(".landing-nav a")?.focus();
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenuOpen(false); document.querySelector<HTMLButtonElement>(".landing-menu")?.focus(); } };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen]);
  const signedIn = Boolean(localStorage.getItem("voxmind_access_token"));
  return <div className="landing-page">
    <a className="skip-link" href="#landing-main">Skip to content</a>
    <header className="landing-header">
      <Link to="/" className="landing-brand" aria-label="MeetingBrief home"><span><AudioLines size={24} /></span>meetingbrief<span className="landing-brand-dot">.</span></Link>
      <nav className={menuOpen ? "landing-nav is-open" : "landing-nav"} aria-label="Main navigation" id="landing-navigation">
        <a href="#features" onClick={() => setMenuOpen(false)}>Why MeetingBrief</a><a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a><Link to="/app/docs">Guides & API</Link>
      </nav>
      <div className="landing-header-actions"><ThemeToggle /><Link to={signedIn ? "/app/overview" : "/login"} className="landing-sign-in">{signedIn ? "Workspace" : "Sign in"}</Link><Link className="landing-button landing-button-small" to={signedIn ? "/app/overview" : "/register"}>{signedIn ? "Open workspace" : "Get started"}<ArrowUpRight size={17} /></Link><button type="button" className="landing-menu" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="landing-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button></div>
    </header>
    <main id="landing-main" tabIndex={-1}>
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="landing-eyebrow"><span /> LESS REPLAYING. MORE PROGRESS.</p>
          <h1>Your meeting ends.<br /><span>The clarity stays.</span></h1>
          <p className="landing-hero-description">Turn meeting recordings into clear summaries, decisions, and next steps. Ask questions. Find the moment. Move the work forward.</p>
          <div className="landing-hero-actions"><Link to="/register" className="landing-button">Create your workspace <ArrowRight size={20} /></Link><a href="#product-preview" className="landing-text-link"><Play size={18} /> See how it works</a></div>
          <p className="landing-hero-note"><LockKeyhole size={15} /> Workspace access controls. Deletion when you need it.</p>
          <div className="landing-provider-row"><span>Bring recordings from</span><span>Zoom</span><span>Google Meet</span><span>Webex</span></div>
        </div>
        <div className="landing-product" id="product-preview" aria-label="Illustrative MeetingBrief workspace preview">
          <div className="landing-preview-top"><span className="landing-window-dots"><i /><i /><i /></span><span>YOUR CONVERSATION, MADE CLEAR</span><span className="landing-preview-example">Example</span></div>
          <div className="landing-preview-content">
            <div className="landing-preview-title"><span className="landing-file-icon"><AudioLines /></span><div><p>Product planning</p><span>Team meeting · 24 minutes</span></div><span className="landing-preview-ready"><Check size={13} /> Ready</span></div>
            <div className="landing-preview-wave"><span className="landing-demo-play" aria-hidden="true"><Play size={17} fill="currentColor" /></span><Waveform /><span>24:08</span></div>
            <div className="landing-preview-tabs"><span className="is-active"><Sparkles size={15} /> Summary</span><span><Target size={15} /> Decisions</span><span><ListChecks size={15} /> Actions</span></div>
            <div className="landing-preview-brief"><p className="landing-card-label">THE MEETING, IN A MINUTE</p><h3>A clearer path to launch.</h3><p>The team agreed on the launch priorities, confirmed the release date, and assigned the next steps.</p></div>
            <div className="landing-preview-decision"><span><Target size={19} /></span><div><p>Decision made</p><h4>Launch the beta on Friday.</h4></div><span>08:42</span></div>
            <div className="landing-preview-task"><CheckCheck size={18} /><p>Alex to share the release checklist</p><span>Thursday</span></div>
            <div className="landing-preview-question"><MessageSquare size={17} /><span>What should we do next?</span><ArrowRight size={17} /></div>
          </div>
          <div className="landing-floating-note"><Sparkles size={18} /><span>A conversation.<br /><strong>A clear next step.</strong></span></div>
        </div>
      </section>
      <div className="landing-value-strip"><span>TRANSCRIBE</span><i /><span>UNDERSTAND</span><i /><span>ACT</span><p>One place for everything that matters after a meeting.</p></div>
      <section className="landing-section" id="features">
        <div className="landing-section-heading"><p className="landing-eyebrow">BUILT FOR THE WORK AFTER THE CALL</p><h2>Good conversations<br />deserve better follow-through.</h2><p>Spend less time reconstructing what happened, and more time doing something with it.</p></div>
        <div className="landing-feature-grid">{features.map(({ icon: Icon, number, title, text }) => <article className="landing-feature" key={number}><div><span className="landing-feature-icon"><Icon /></span><span>{number}</span></div><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>
      <section className="landing-process" id="how-it-works"><div><p className="landing-eyebrow">A SIMPLE ROUTINE</p><h2>From “what did we agree?”<br />to “here’s what’s next.”</h2><Link to="/register" className="landing-text-link">Make your next meeting count <ArrowRight size={18} /></Link></div><ol>{[
        { icon: Upload, title: "Bring the recording", text: "Upload an audio file or connect your meeting account and choose a completed recording." },
        { icon: Sparkles, title: "Let the details come together", text: "MeetingBrief transcribes the audio and prepares a summary, decisions, and action items." },
        { icon: CheckCheck, title: "Take the next step", text: "Ask follow-up questions, mark tasks complete, or export a PDF with all four insight sections." },
      ].map(({ icon: Icon, title, text }, index) => <li key={title}><span>{index + 1}</span><div><h3><Icon size={20} />{title}</h3><p>{text}</p></div></li>)}</ol></section>
      <section className="landing-section landing-connections" id="integrations"><div className="landing-section-heading"><p className="landing-eyebrow">YOUR MEETINGS. YOUR WORKFLOW.</p><h2>Start where the conversation happened.</h2><p>Connect an account, approve access, and choose what to import. No developer setup required for your account.</p></div><div className="landing-connection-grid">{[{ name: "Zoom", note: "Import completed cloud recordings.", initial: "z" }, { name: "Google Meet", note: "Bring in meeting recordings from Drive.", initial: "M" }, { name: "Webex", note: "Import downloadable meeting recordings.", initial: "w" }].map((provider) => <Link to="/app/docs#meetings" key={provider.name}><span className="landing-provider-icon">{provider.initial}</span><h3>{provider.name}</h3><p>{provider.note}</p><span className="landing-text-link">Connection guide <ArrowUpRight size={17} /></span></Link>)}</div><p className="landing-integration-note"><Video size={16} /> Provider recording access and plan requirements apply. Imports use existing recordings.</p></section>
      <section className="landing-api"><div><span className="landing-feature-icon"><Code2 /></span><h2>Make meeting intelligence<br />part of your product.</h2><p>Upload recordings and retrieve transcripts, insights, and answers through a documented API. Create keys with the permissions your workflow needs.</p><Link to="/app/docs#api" className="landing-text-link">Explore the API <ArrowRight size={18} /></Link></div><div className="landing-api-card"><div><span>POST</span><code>/api/v1/recordings</code></div><pre><code>{'{\n  "success": true,\n  "data": {\n    "id": "your-recording-id",\n    "status": "queued"\n  }\n}'}</code></pre><p>Upload → check progress → retrieve results</p></div></section>
      <section className="landing-final-cta"><p className="landing-eyebrow">MAKE ROOM FOR THE NEXT GOOD IDEA</p><h2>Keep the conversation.<br />Leave the busywork.</h2><Link to="/register" className="landing-button">Get started with MeetingBrief <ArrowRight size={20} /></Link><Link to="/login" className="landing-text-link">Already have an account? Sign in</Link></section>
      <section className="landing-faq landing-section"><h2>A little more clarity.</h2>{[
        ["Does MeetingBrief join or record my calls?", "No. You upload a recording or select a completed cloud recording from a connected provider. Connecting an account does not start a meeting or record participants."],
        ["What do I get from a recording?", "A timestamped transcript, summary, key takeaways, decisions, and action items. You can ask questions about the transcript and export your insights and saved questions as a PDF."],
        ["Where is my recording processed?", "The service’s transcription and AI services process audio on its servers. You can delete recordings from your workspace. If your confidentiality requirements prohibit uploading, consider a self-hosted deployment."],
        ["Can I use it from my own application?", "Yes. Create a server-side API key in Integrations and follow the API quickstart. Read-only and read/write keys let you choose the access each integration needs."],
        ["Can I delete my recordings?", "Yes. You can delete a recording from your workspace. This removes its stored audio, transcript, insights, and saved questions from the application. Deployment backups may have a separate retention period."],
      ].map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={18} /></summary><p>{answer}</p></details>)}</section>
    </main>
    <footer className="landing-footer"><Link className="landing-brand" to="/">meetingbrief<span className="landing-brand-dot">.</span></Link><p>Every conversation. A clearer next step.</p><nav aria-label="Footer"><Link to="/app/docs">Guides & API</Link><Link to="/privacy">Privacy</Link><Link to="/login">Sign in</Link></nav></footer>
  </div>;
}
