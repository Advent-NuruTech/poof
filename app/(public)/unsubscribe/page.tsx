import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

export const metadata = {
  title: "Email preferences",
  robots: { index: false, follow: false },
};

type UnsubscribePageProps = {
  searchParams: Promise<{ id?: string; sig?: string }>;
};

function UnsubscribeLoading() {
  return (
    <main className="unsubscribe-page">
      <section className="unsubscribe-card">
        <span className="unsubscribe-eyebrow">FAITH OF THE PIONEERS</span>
        <p>Loading your email preferences…</p>
      </section>
    </main>
  );
}

async function UnsubscribeForm({ searchParams }: UnsubscribePageProps) {
  const { id = "", sig = "" } = await searchParams;
  const action = `/api/mailing/unsubscribe?id=${encodeURIComponent(id)}&sig=${encodeURIComponent(sig)}`;

  return (
    <main className="unsubscribe-page">
      <section className="unsubscribe-card" aria-labelledby="unsubscribe-title">
        <Image src="/images/logo.jpeg" alt="" width={72} height={72} priority />
        <span className="unsubscribe-eyebrow">FAITH OF THE PIONEERS</span>
        <h1 id="unsubscribe-title">Email preferences</h1>
        <p>You are in control of your inbox. You can stop receiving our newsletter at any time.</p>
        <form method="post" action={action}>
          <button type="submit">Unsubscribe from the newsletter</button>
        </form>
        <Link className="unsubscribe-home" href="/">Keep my subscription and return home</Link>
        <small>This link is personal to your subscription. If you did not request it, you can safely close this page.</small>
      </section>
    </main>
  );
}

export default function UnsubscribePage(props: UnsubscribePageProps) {
  return (
    <Suspense fallback={<UnsubscribeLoading />}>
      <UnsubscribeForm searchParams={props.searchParams} />
    </Suspense>
  );
}
