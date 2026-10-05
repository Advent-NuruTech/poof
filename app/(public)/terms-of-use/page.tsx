export default function TermsOfUsePage() {
  return (
    <main className="doctrine-page">
      <header className="doctrine-header">
        <a href="/">← Back to home</a>
        <span>LEGAL</span>
        <h1>Terms of Use</h1>
        <p>Last updated: October 4, 2026</p>
      </header>

      <section style={{ maxWidth: 760, margin: "32px auto 0", lineHeight: 1.7, fontSize: 15, color: "#333" }}>
        <h2 style={{ fontSize: 22, marginTop: 32 }}>1. Acceptance of Terms</h2>
        <p>
          By accessing and using this website ("Faith of the Pioneers"), you accept and agree to be bound by the
          terms and provisions of this agreement. If you do not agree to these terms, please do not use this website.
        </p>

        <h2 style={{ fontSize: 22, marginTop: 32 }}>2. Use of the Website</h2>
        <p>
          This website provides a catalog of video content from YouTube. All video content is hosted and provided by
          YouTube. You agree to use this website only for lawful purposes and in a way that does not infringe the
          rights of others.
        </p>

        <h2 style={{ fontSize: 22, marginTop: 32 }}>3. Intellectual Property</h2>
        <p>
          The design, layout, and website-specific content of this site are owned by us. However, all video content,
          thumbnails, and related metadata displayed on this site belong to their respective owners and are provided
          via YouTube's services. YouTube content is subject to YouTube's Terms of Service.
        </p>
        <p>
          YouTube's Terms of Service can be found at:{" "}
          <a href="https://www.youtube.com/static?template=terms" target="_blank" rel="noopener noreferrer" style={{ color: "#c51c31" }}>
            YouTube Terms of Service
          </a>
        </p>

        <h2 style={{ fontSize: 22, marginTop: 32 }}>4. Links to Third-Party Sites</h2>
        <p>
          Our website contains links to third-party websites (including YouTube). We have no control over the
          content, privacy policies, or practices of these websites and assume no responsibility for them. Your use
          of third-party websites is at your own risk.
        </p>

        <h2 style={{ fontSize: 22, marginTop: 32 }}>5. Disclaimer of Warranties</h2>
        <p>
          This website is provided "as is" without any representations or warranties, express or implied. We make no
          representations or warranties regarding the accuracy, completeness, or availability of the content or the
          website itself.
        </p>

        <h2 style={{ fontSize: 22, marginTop: 32 }}>6. Limitation of Liability</h2>
        <p>
          To the fullest extent permitted by law, we shall not be liable for any direct, indirect, incidental,
          consequential, or punitive damages arising from your use of or inability to use this website.
        </p>

        <h2 style={{ fontSize: 22, marginTop: 32 }}>7. Changes to Terms</h2>
        <p>
          We reserve the right to modify these Terms of Use at any time. Changes will be effective immediately upon
          posting. Your continued use of the website after changes constitutes acceptance of the modified terms.
        </p>

        <h2 style={{ fontSize: 22, marginTop: 32 }}>8. Contact Us</h2>
        <p>
          If you have any questions about these Terms of Use, please <a href="/contact" style={{ color: "#c51c31" }}>contact us</a>.
        </p>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #e8e9e6" }}>
          <a href="/" style={{ color: "#666", fontSize: 14 }}>← Back to home</a>
        </div>
      </section>
    </main>
  );
}