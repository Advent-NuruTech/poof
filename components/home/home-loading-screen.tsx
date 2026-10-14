import Image from "next/image";

export default function HomeLoadingScreen() {
  return (
    <div className="home-loading-screen" role="status" aria-live="polite">
      <div className="home-loading-content">
        <Image
          className="home-loading-logo"
          src="/images/logo.jpeg"
          alt=""
          width={64}
          height={64}
          preload
        />
        <p className="home-loading-brand">Faith of the Pioneers</p>
        <p className="home-loading-message">Preparing your experience</p>
        <div className="home-loading-track" aria-hidden="true">
          <span />
        </div>
        <span className="home-loading-caption">A moment while we get things ready</span>
      </div>
    </div>
  );
}
