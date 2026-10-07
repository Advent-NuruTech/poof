import Link from "next/link";

/** Shared footer links and ministry attribution for public pages. */
export default function SiteFooter() {
  return <footer className="site-footer"><div className="footer-inner"><p className="footer-copyright">© 2026 Pioneers Of Our Faith. All rights reserved.</p><nav className="footer-links" aria-label="Footer navigation"><Link href="/doctrine/fundermentalprinciples">Fundamental Principles</Link><Link href="/privacy-policy">Privacy Policy</Link><Link href="/terms-of-use">Terms of Use</Link><Link href="/cookies-policy">Cookies Policy</Link><Link href="/contact">Contact us</Link></nav><span className="powered-by"><span className="powered-by-text">Powered by Advent Nurutech</span></span></div></footer>;
}
