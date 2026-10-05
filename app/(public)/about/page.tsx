import Link from "next/link";
import AboutMostViewed from "@/components/home/about-most-viewed";

export default function AboutPage() {
  return <main className="doctrine-page">
    <header className="doctrine-header">
      <Link href="/">← Back to home</Link>
      <span>ABOUT US</span>
      <h1>About the Ministry</h1>
      <p>Faith of the Pioneers is an online fellowship devoted to studying Scripture and recovering the simple, Bible-centered faith of the early Adventist pioneers.</p>
    </header>

    <section style={{ maxWidth: 760, margin: "32px auto 0", lineHeight: 1.7, fontSize: 16, color: "#333" }}>
      <h2 style={{ fontSize: 24, marginTop: 32 }}>Faith of the Pioneers</h2>
      <p><strong>Faith of the Pioneers</strong> is an online fellowship devoted to studying Scripture, sharing personal testimonies, and recovering the simple, Bible-centered faith of the early Adventist pioneers. Through live Zoom meetings and recorded messages, we seek to prepare hearts for the soon return of Jesus Christ.</p>

      <h2 style={{ fontSize: 24, marginTop: 32 }}>Who We Are</h2>
      <p>Faith of the Pioneers began as a gathering place for believers who want to walk in the footsteps of the Advent movement&apos;s pioneers. Our focus is deep Bible study, especially the books of <strong>Daniel and Revelation</strong>, along with practical Christian living, health principles, marriage and family, and personal testimonies of God&apos;s leading.</p>

      <h2 style={{ fontSize: 24, marginTop: 32 }}>Join Us Weekly</h2>
      <p>Believers from many countries meet every week to search the Scriptures, encourage one another, and hold fast to the truths that defined the pioneer era. Whoever hungers for present truth and sincere fellowship is welcome.</p>

      <h3 style={{ fontSize: 20, marginTop: 24 }}>Meeting times (online via Zoom)</h3>
      <ul style={{ paddingLeft: 24 }}>
        <li><strong>Sundays:</strong> 7:00 PM Norway time (10:00 AM California)</li>
        <li><strong>Tuesdays:</strong> 7:00 PM Norway time (10:00 AM California)</li>
      </ul>

      <h2 style={{ fontSize: 24, marginTop: 32 }}>How to Join</h2>
      <p>To protect our meetings and keep our fellowship peaceful, we share the meeting link privately. <strong>To join our online meetings, please request the link:</strong></p>
      <p style={{ marginTop: 16 }}><Link href="/meeting-link-request" style={{ color: "#c51c31", fontWeight: 600 }}>Request the next Zoom meeting link</Link></p>
      <p><a href="mailto:birdmanjo@gmail.com" style={{ color: "#c51c31", fontWeight: 600 }}>birdmanjo@gmail.com</a></p>
      <p>Tell us your name and country, and our team will review your request.</p>

      <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #e8e9e6" }}><Link href="/" style={{ color: "#666", fontSize: 14 }}>← Back to home</Link></div>
    </section>
    <AboutMostViewed />
  </main>;
}
