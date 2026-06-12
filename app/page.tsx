import { getNews } from "@/lib/rss";
import { SOURCES } from "@/lib/sources";
import NewsFeed from "./components/NewsFeed";

// Sidan renderas på servern och uppdateras minst var 5:e minut.
export const revalidate = 300;

function formatDate(): string {
  const d = new Date().toLocaleDateString("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return d.charAt(0).toUpperCase() + d.slice(1);
}

export default async function Home() {
  const initial = await getNews();

  return (
    <main className="container">
      <header className="masthead">
        <p className="masthead__date">{formatDate()}</p>
        <h1>
          Vad<span className="accent">sker</span>
        </h1>
        <p className="tagline">Topnyheter från svenska medier – på en sida.</p>
      </header>

      <NewsFeed initial={initial} />

      <footer className="footer">
        <div className="footer__brand">
          Vad<span className="accent">sker</span>
        </div>
        <p className="footer__sources">
          Källor: {SOURCES.map((s) => s.name).join(" · ")}
        </p>
        <p className="footer__disclaimer">
          Vadsker är en nyhetsaggregator. Rubriker, ingresser och bilder hämtas
          från respektive mediums offentliga RSS-flöden och tillhör sina
          respektive upphovsrättsinnehavare. Klicka på en nyhet för att läsa
          hela artikeln hos källan.
        </p>
        <p className="footer__copyright">
          © {new Date().getFullYear()} Vadsker · Ej affilierad med ovanstående
          medier.
        </p>
      </footer>
    </main>
  );
}
