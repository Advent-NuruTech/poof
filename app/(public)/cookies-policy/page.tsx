export default function CookiesPolicyPage() {
  return (
    <main className="doctrine-page">
      <header className="doctrine-header">
        <a href="/">← Back to home</a>
        <span>LEGAL</span>
        <h1>Cookies Policy</h1>
        <p>Last updated: October 4, 2026</p>
      </header>

      <section style={{ maxWidth: 760, margin: "32px auto 0", lineHeight: 1.7, fontSize: 15, color: "#333" }}>
        <h2 style={{ fontSize: 22, marginTop: 32 }}>1. What Are Cookies</h2>
        <p>
          Cookies are small text files that are stored on your device when you visit a website. They help websites
          remember your preferences and improve your browsing experience.
        </p>

        <h2 style={{ fontSize: 22, marginTop: 32 }}>2. How We Use Cookies</h2>
        <p>
          We may use cookies and similar technologies for the following purposes:
        </p>
        <ul style={{ paddingLeft: 24 }}>
          <li>
            <strong>Essential cookies:</strong> Necessary for the website to function properly
          </li>
          <li>
            <strong>Functional cookies:</strong> Remember your preferences and settings
          </li>
          <li>
            <strong>Analytics cookies:</strong> Help us understand how visitors use our website to improve it
          </li>
        </ul>

        <h2 style={{ fontSize: 22, marginTop: 32 }}>3. Third-Party Cookies</h2>
        <p>Some cookies may be set by third-party services integrated into our website:</p>
        <ul style={{ paddingLeft: 24 }}>
          <li>
            <strong>YouTube:</strong> When you watch embedded YouTube videos, YouTube may set cookies on your device.
            These are governed by Google's <a href="https://policies.google.com/technologies/cookies" target="_blank" rel="noopener noreferrer" style={{ color: "#c51c31" }}>Cookies Policy</a>.
          </li>
          <li>
            <strong>Firebase/Google:</strong> Firebase services may use cookies for authentication and analytics as
            described in Google's policies.
          </li>
        </ul>

        <h2 style={{ fontSize: 22, marginTop: 32 }}>4. Managing Cookies</h2>
        <p>
          You can control and manage cookies in your browser settings. Most browsers allow you to block or delete
          cookies. Please note that disabling certain cookies may affect the functionality of this website.
        </p>
        <p>Instructions for managing cookies can be found in your browser's help documentation.</p>

        <h2 style={{ fontSize: 22, marginTop: 32 }}>5. Changes to This Policy</h2>
        <p>
          We may update this Cookies Policy from time to time. The "Last updated" date at the top of this page
          indicates when changes were last made. Continued use of the website after changes constitutes acceptance of
          the updated policy.
        </p>

        <h2 style={{ fontSize: 22, marginTop: 32 }}>6. Contact Us</h2>
        <p>
          If you have any questions about this Cookies Policy, please <a href="/contact" style={{ color: "#c51c31" }}>contact us</a>.
        </p>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #e8e9e6" }}>
          <a href="/" style={{ color: "#666", fontSize: 14 }}>← Back to home</a>
        </div>
      </section>
    </main>
  );
}