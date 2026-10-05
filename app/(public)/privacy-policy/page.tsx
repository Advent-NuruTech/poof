export default function PrivacyPolicyPage() {
  return (
    <main className="doctrine-page">
      <header className="doctrine-header">
        <a href="/">← Back to home</a>
        <span>LEGAL</span>
        <h1>Privacy Policy</h1>
        <p>Last updated: October 4, 2026</p>
      </header>

      <section style={{ maxWidth: 760, margin: "32px auto 0", lineHeight: 1.7, fontSize: 15, color: "#333" }}>
        <h2 style={{ fontSize: 22, marginTop: 32 }}>1. Introduction</h2>
        <p>
          This website ("Faith of the Pioneers") is a video catalog that displays content from YouTube channels.
          We respect your privacy and are committed to protecting it. This Privacy Policy explains how we collect,
          use, and safeguard your information when you visit our website.
        </p>

        <h2 style={{ fontSize: 22, marginTop: 32 }}>2. Information We Collect</h2>
        <p>We may collect limited information in the following ways:</p>
        <ul style={{ paddingLeft: 24 }}>
          <li>
            <strong>Information you provide:</strong> If you use the contact form, we collect your name, email
            address, phone number (optional), and message to respond to your inquiry.
          </li>
          <li>
            <strong>Automatically collected information:</strong> Like most websites, we may collect basic technical
            information such as your IP address, browser type, device information, and pages visited through standard
            web server logs and analytics tools.
          </li>
          <li>
            <strong>Cookies:</strong> We may use cookies to improve your experience. See our Cookies Policy for more
            details.
          </li>
        </ul>

        <h2 style={{ fontSize: 22, marginTop: 32 }}>3. How We Use Your Information</h2>
        <p>We use the information we collect to:</p>
        <ul style={{ paddingLeft: 24 }}>
          <li>Respond to inquiries submitted through our contact form</li>
          <li>Maintain and improve the functionality of our website</li>
          <li>Analyze usage patterns to improve user experience</li>
          <li>Comply with legal obligations</li>
        </ul>

        <h2 style={{ fontSize: 22, marginTop: 32 }}>4. Third-Party Services</h2>
        <p>
          Our website uses third-party services that have their own privacy policies:
        </p>
        <ul style={{ paddingLeft: 24 }}>
          <li>
            <strong>YouTube:</strong> Our content is hosted on YouTube. When you watch videos, you are subject to
            YouTube's <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#c51c31" }}>Privacy Policy</a>.
          </li>
          <li>
            <strong>Firebase:</strong> We use Firebase (by Google) for data storage and authentication. Your use of
            Firebase is subject to Google's <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#c51c31" }}>Privacy Policy</a>.
          </li>
        </ul>

        <h2 style={{ fontSize: 22, marginTop: 32 }}>5. Data Security</h2>
        <p>
          We implement reasonable security measures to protect your information. However, no method of transmission
          over the internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
        </p>

        <h2 style={{ fontSize: 22, marginTop: 32 }}>6. Your Rights</h2>
        <p>
          Depending on your location, you may have rights regarding your personal data, including the right to access,
          correct, or delete your information. If you have questions or wish to exercise these rights, please contact
          us through our contact form.
        </p>

        <h2 style={{ fontSize: 22, marginTop: 32 }}>7. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. The "Last updated" date at the top of this page
          indicates when changes were last made. Continued use of the website after changes constitutes acceptance of
          the updated policy.
        </p>

        <h2 style={{ fontSize: 22, marginTop: 32 }}>8. Contact Us</h2>
        <p>
          If you have any questions about this Privacy Policy, please <a href="/contact" style={{ color: "#c51c31" }}>contact us</a>.
        </p>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #e8e9e6" }}>
          <a href="/" style={{ color: "#666", fontSize: 14 }}>← Back to home</a>
        </div>
      </section>
    </main>
  );
}