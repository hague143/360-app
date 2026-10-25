import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Menu,
  X,
  Plus,
  LogOut,
  CarFront,
  MapPin,
  ChevronDown,
  ScanLine,
  Check,
  UserRound,
  ShieldCheck,
  Layers,
  Camera,
  MousePointer2,
} from "lucide-react";
import { api, send, money, photoUrl } from "./api";
import type { User, Listing, Area, Vehicle } from "./types";
import { Modal, ErrorBox, Loading, Badge } from "./ui";
import Inspection from "./Inspection";
import Dashboard from "./Dashboard";
import Admin from "./Admin";
export default function App() {
  const [path, setPath] = useState(location.pathname),
    [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [auth, setAuth] = useState(false),
    [guide, setGuide] = useState(false),
    [menu, setMenu] = useState(false),
    [areas, setAreas] = useState<Area[]>([]),
    [recommended, setRecommended] = useState<string[]>([]),
    [catalog, setCatalog] = useState<Vehicle[]>([]),
    [bootError, setBootError] = useState("");
  const navigate = (to: string) => {
    history.pushState({}, "", to);
    setPath(to);
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  useEffect(() => {
    const pop = () => setPath(location.pathname);
    window.addEventListener("popstate", pop);
    Promise.all([
      api<User | null>("/me"),
      api("/taxonomy"),
      api<Vehicle[]>("/catalog"),
    ])
      .then(([u, t, c]) => {
        setUser(u);
        setAreas(t.areas);
        setRecommended(t.recommended);
        setCatalog(c);
        setReady(true);
      })
      .catch((e) => setBootError(e.message));
    return () => window.removeEventListener("popstate", pop);
  }, []);
  const sell = () => (user ? navigate("/garage/new") : setAuth(true));
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <a
            href="/"
            className="brand"
            onClick={(e) => {
              e.preventDefault();
              navigate("/");
            }}
          >
            <span className="brand-icon">
              <ScanLine size={25} />
            </span>
            <span>
              carview<span className="brand-country">PAKISTAN</span>
            </span>
          </a>
          <nav className={menu ? "open" : ""} aria-label="Main navigation">
            <a
              href="/explore"
              className={
                path === "/" ||
                path.startsWith("/listing") ||
                path === "/explore"
                  ? "active"
                  : ""
              }
              onClick={(e) => {
                e.preventDefault();
                navigate("/explore");
              }}
            >
              Explore cars
            </a>
            <a
              href="/garage"
              className={path.startsWith("/garage") ? "active" : ""}
              onClick={(e) => {
                e.preventDefault();
                navigate("/garage");
              }}
            >
              My garage
            </a>
            <button
              onClick={() => {
                setGuide(true);
                setMenu(false);
              }}
            >
              How it works <ArrowUpRight size={12} />
            </button>
            {user?.role === "admin" && (
              <button onClick={() => navigate("/admin")}>Administration</button>
            )}
          </nav>
          <div className="header-actions">
            <span className="country">
              <span className="pak-flag">☾</span> Pakistan
            </span>
            {user ? (
              <button
                className="account-button"
                title="Sign out"
                onClick={async () => {
                  await send("/auth/logout", {});
                  setUser(null);
                  navigate("/");
                }}
              >
                <UserRound size={17} />
                <span>{user.name.split(" ")[0]}</span>
                <LogOut size={14} />
              </button>
            ) : (
              <button className="sign-in" onClick={() => setAuth(true)}>
                Sign in
              </button>
            )}
            <button className="button primary sell-button" onClick={sell}>
              <Plus size={16} /> Sell your car
            </button>
            <button
              className="icon-button mobile-menu"
              aria-label="Toggle navigation"
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <main>
        {bootError ? (
          <div className="page">
            <ErrorBox error={bootError} />
            <button className="button" onClick={() => location.reload()}>
              Retry connection
            </button>
          </div>
        ) : !ready ? (
          <Loading />
        ) : path === "/admin" ? (
          <Admin
            catalog={catalog}
            user={user}
            onCatalog={() => api<Vehicle[]>("/catalog").then(setCatalog)}
          />
        ) : path.startsWith("/garage") ? (
          <Dashboard
            user={user}
            onAuth={() => setAuth(true)}
            path={path}
            navigate={navigate}
            catalog={catalog}
            areas={areas}
            recommended={recommended}
          />
        ) : path === "/explore" ? (
          <Explore navigate={navigate} sell={sell} />
        ) : (
          <Inspection
            id={
              path.startsWith("/listing/") ? path.split("/")[2] : "demo-corolla"
            }
            areas={areas}
            recommended={recommended}
            navigate={navigate}
            sell={sell}
          />
        )}
      </main>
      <footer className="site-footer">
        <span className="footer-brand">
          <ScanLine size={17} /> A little more clarity. A lot more confidence.
        </span>
        <span>
          Built for better car conversations.{" "}
          <span className="footer-dot">●</span> Made for Pakistan
        </span>
      </footer>
      {auth && (
        <Auth
          onClose={() => setAuth(false)}
          onSuccess={(u) => {
            setUser(u);
            setAuth(false);
            navigate("/garage");
          }}
        />
      )}
      {guide && (
        <Modal
          title="Know the car. See the details."
          onClose={() => setGuide(false)}
        >
          <div className="guide-grid">
            {[
              [
                Layers,
                "1. Choose your vehicle",
                "Sellers select the exact generation, trim and Pakistan specification. Only an approved matching asset enables 3D.",
              ],
              [
                Camera,
                "2. Add original photographs",
                "Upload your actual car photos and manually confirm the parts or viewing angles they show.",
              ],
              [
                MousePointer2,
                "3. Explore, part by part",
                "Buyers select an area to see its uploaded photographs. Missing photos are always marked.",
              ],
            ].map(([Icon, title, text]: any) => (
              <section key={title}>
                <Icon size={24} />
                <h3>{title}</h3>
                <p>{text}</p>
              </section>
            ))}
          </div>
          <div className="info-note">
            <ShieldCheck size={20} />
            <p>
              A reference model is a navigation tool. Photo coverage is not a
              condition score, authenticity check, ownership proof or inspection
              certification. Arrange an independent inspection before buying.
            </p>
          </div>
          <button
            className="button primary"
            onClick={() => {
              setGuide(false);
              sell();
            }}
          >
            Create a listing <ArrowRight size={16} />
          </button>
        </Modal>
      )}
    </>
  );
}
function Auth({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (u: User) => void;
}) {
  const [register, setRegister] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal
      title={register ? "Your garage starts here." : "Welcome back."}
      onClose={onClose}
    >
      <p className="muted-text">
        {register
          ? "One account. Every detail of your car."
          : "Sign in to manage your listings and original photos."}
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setBusy(true);
          const f = Object.fromEntries(new FormData(e.currentTarget));
          try {
            onSuccess(
              await send(register ? "/auth/register" : "/auth/login", f),
            );
          } catch (e: any) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <ErrorBox error={error} />
        {register && (
          <label>
            Your name
            <input
              name="name"
              autoComplete="name"
              required
              maxLength={80}
              placeholder="e.g. Ahmed Khan"
            />
          </label>
        )}
        <label>
          Email address
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete={register ? "new-password" : "current-password"}
            minLength={register ? 10 : 1}
            maxLength={128}
            required
            placeholder={
              register ? "At least 10 characters" : "Enter your password"
            }
          />
        </label>
        <button disabled={busy} className="button primary full">
          {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
          <ArrowRight size={16} />
        </button>
      </form>
      <p className="auth-switch">
        {register ? "Already have an account?" : "New to CarView?"}{" "}
        <button
          className="text-button"
          onClick={() => {
            setRegister(!register);
            setError("");
          }}
        >
          {register ? "Sign in" : "Create an account"}
        </button>
      </p>
    </Modal>
  );
}
function Explore({
  navigate,
  sell,
}: {
  navigate: (p: string) => void;
  sell: () => void;
}) {
  const [list, setList] = useState<Listing[]>([]),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [page, setPage] = useState(1),
    [more, setMore] = useState(false);
  useEffect(() => {
    api(`/listings?page=${page}`)
      .then((r) => {
        setList((prev) => (page === 1 ? r.items : [...prev, ...r.items]));
        setMore(r.hasMore);
      })
      .catch((e) => setError(e.message));
  }, [page]);
  return (
    <div className="page explore-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow green">A BETTER WAY TO LOOK</span>
          <h1>
            Every car has a story.
            <br />
            See the whole picture.
          </h1>
          <p className="muted-text">
            Original photos. Organized details. Your next car, in view.
          </p>
        </div>
        <button className="button primary" onClick={sell}>
          List your car <Plus size={16} />
        </button>
      </div>
      <div className="search-bar">
        <CarFront size={20} />
        <input
          aria-label="Search listings"
          placeholder="Search make, model or city…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span>
          {list.length} {list.length === 1 ? "listing" : "listings"}
        </span>
      </div>
      <ErrorBox error={error} />
      <div className="listing-grid">
        {list
          .filter((l) =>
            (l.title + " " + l.city)
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .map((l) => (
            <a
              className="listing-card"
              key={l.id}
              href={"/listing/" + l.id}
              onClick={(e) => {
                e.preventDefault();
                navigate("/listing/" + l.id);
              }}
            >
              <div className="listing-card-image">
                {l.photos[0] ? (
                  <img
                    src={photoUrl(l.photos[0].id)}
                    alt={l.title}
                    loading="lazy"
                  />
                ) : (
                  <div className="no-cover">
                    <CarFront size={70} strokeWidth={1} />
                    <span>No seller photos uploaded</span>
                  </div>
                )}
                <Badge muted={!!l.demo}>
                  {l.demo ? "DEMONSTRATION" : "SELLER LISTING"}
                </Badge>
                <span className="card-arrow">
                  <ArrowUpRight size={21} />
                </span>
              </div>
              <div className="listing-card-info">
                <small>
                  {l.year} · {l.vehicle.variant}
                </small>
                <h2>{l.title}</h2>
                <p>
                  <MapPin size={14} />
                  {l.city}
                  <span>{money(l.mileage)} km</span>
                </p>
                <div>
                  <strong>PKR {money(l.price)}</strong>
                  <span>
                    {l.coverage}/{l.recommended} areas photographed
                  </span>
                </div>
              </div>
            </a>
          ))}
      </div>
      {!list.length && !error && <Loading />}
      {more && (
        <button className="button" onClick={() => setPage(page + 1)}>
          Load more listings
        </button>
      )}
      <div className="explore-note">
        <ShieldCheck size={21} />
        <p>
          Photos show what the seller uploaded. They do not certify a vehicle’s
          condition, ownership or authenticity.
        </p>
      </div>
    </div>
  );
}
