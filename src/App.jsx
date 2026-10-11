import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "./supabase";
import Hls from "hls.js";
import "./App.css";

const BRAZIL_PLAYLIST =
  "https://iptv-org.github.io/iptv/countries/br.m3u";

const WORLD_PLAYLIST =
  "https://iptv-org.github.io/iptv/index.m3u";

const demoSeries = [
  {
    id: "demo-1",
    title: "Contrato de Amor",
    category: "Romance",
    description:
      "Um acordo inesperado aproxima duas pessoas que juraram nunca se apaixonar.",
    image:
      "https://images.unsplash.com/photo-1516589178581-6cd7833ae35b?auto=format&fit=crop&w=700&q=80",
  },
  {
    id: "demo-2",
    title: "Segredo da Meia-Noite",
    category: "Suspense",
    description:
      "Uma descoberta inesperada muda tudo depois de uma noite misteriosa.",
    image:
      "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=700&q=80",
  },
  {
    id: "demo-3",
    title: "Entre Dois Corações",
    category: "Romance",
    description:
      "Dois destinos se cruzam e revelam sentimentos impossíveis de esconder.",
    image:
      "https://images.unsplash.com/photo-1516589178581-6cd7833ae35b?auto=format&fit=crop&w=700&q=80",
  },
];

const categories = [
  "Todas",
  "Romance",
  "Vingança",
  "Suspense",
  "Bilionários",
  "Casamento",
];

function parseM3U(content, countryName = "Internacional") {
  const lines = content.split(/\r?\n/);
  const channels = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) continue;

    if (line.startsWith("#EXTINF:")) {
      const name = line.split(",").slice(1).join(",").trim();

      const logo =
        line.match(/tvg-logo="([^"]*)"/i)?.[1] || "";

      const country =
        line.match(/tvg-country="([^"]*)"/i)?.[1] ||
        countryName;

      const group =
        line.match(/group-title="([^"]*)"/i)?.[1] ||
        "Outros";

      const id =
        line.match(/tvg-id="([^"]*)"/i)?.[1] || "";

      current = {
        id: id || `${country}-${name}`,
        name: name || "Canal sem nome",
        logo,
        country,
        category: group,
        url: "",
      };

      continue;
    }

    if (line.startsWith("#")) continue;

    if (current && /^https?:\/\//i.test(line)) {
      current.url = line;

      channels.push(current);
      current = null;
    }
  }

  return channels;
}

function normalizeChannel(channel, index = 0) {
  return {
    id: String(channel.id ?? `channel-${index}`),
    name:
      channel.name ||
      channel.title ||
      channel.channel_name ||
      "Canal sem nome",
    logo:
      channel.logo ||
      channel.tvg_logo ||
      channel.image ||
      "",
    country:
      channel.country ||
      channel.tvg_country ||
      "Não informado",
    category:
      channel.category ||
      channel.group_title ||
      channel.group ||
      "Outros",
    url:
      channel.url ||
      channel.stream_url ||
      channel.video_url ||
      "",
  };
}

function isHlsUrl(url) {
  return /\.m3u8(?:$|[?#])/i.test(url);
}

export default function App() {
  const [activeTab, setActiveTab] = useState("series");
  const [series, setSeries] = useState([]);
  const [movies, setMovies] = useState([]);
  const [channels, setChannels] = useState([]);
  const [episodes, setEpisodes] = useState([]);

  const [selectedSeries, setSelectedSeries] = useState(null);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [playing, setPlaying] = useState(null);

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [selectedCountry, setSelectedCountry] = useState("Todos");
  const [channelSource, setChannelSource] = useState("br");

  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("dramovix-favorites") || "[]"
      );
    } catch {
      return [];
    }
  });

  const [loading, setLoading] = useState(false);
  const [channelLoading, setChannelLoading] = useState(false);
  const [error, setError] = useState("");

  const videoRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(
      "dramovix-favorites",
      JSON.stringify(favorites)
    );
  }, [favorites]);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      setLoading(true);

      try {
        const [
          { data: seriesData, error: seriesError },
          { data: moviesData },
          { data: channelsData },
        ] = await Promise.all([
          supabase
            .from("series")
            .select("*")
            .eq("published", true)
            .order("created_at", { ascending: false }),

          supabase
            .from("movies")
            .select("*")
            .eq("published", true)
            .order("created_at", { ascending: false }),

          supabase
            .from("channels")
            .select("*")
            .eq("published", true),
        ]);

        if (seriesError) {
          console.warn("Erro ao carregar séries:", seriesError);
        }

        if (cancelled) return;

        const preparedSeries = (seriesData || []).map((item) => ({
          ...item,
          title: item.title || item.name || "Sem título",
          category: item.category || "Romance",
          description: item.description || "",
          image:
            item.image ||
            item.cover_url ||
            item.poster_url ||
            "",
        }));

        setSeries(
          preparedSeries.length > 0
            ? preparedSeries
            : demoSeries
        );

        setMovies(moviesData || []);

        const preparedChannels = (channelsData || [])
          .map(normalizeChannel)
          .filter((channel) => channel.url);

        setChannels(preparedChannels);
      } catch (err) {
        console.error("Erro ao carregar catálogo:", err);

        if (!cancelled) {
          setSeries(demoSeries);
          setMovies([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadEpisodes() {
      if (!selectedSeries) {
        setEpisodes([]);
        return;
      }

      const seriesId = selectedSeries.id;

      try {
        const { data, error: episodeError } = await supabase
          .from("episodes")
          .select("*")
          .eq("series_id", seriesId)
          .order("episode_number", { ascending: true });

        if (episodeError) {
          console.warn("Erro ao carregar episódios:", episodeError);
          return;
        }

        if (!cancelled) {
          setEpisodes(data || []);
        }
      } catch (err) {
        console.error("Erro ao carregar episódios:", err);
      }
    }

    loadEpisodes();

    return () => {
      cancelled = true;
    };
  }, [selectedSeries]);

  useEffect(() => {
    let cancelled = false;

    async function loadPlaylist() {
      setChannelLoading(true);
      setError("");

      const playlistUrl =
        channelSource === "world"
          ? WORLD_PLAYLIST
          : BRAZIL_PLAYLIST;

      try {
        const response = await fetch(playlistUrl);

        if (!response.ok) {
          throw new Error(
            `A lista respondeu com o código ${response.status}.`
          );
        }

        const content = await response.text();

        if (!content.includes("#EXTINF")) {
          throw new Error("A playlist não contém canais reconhecíveis.");
        }

        const countryName =
          channelSource === "world" ? "Internacional" : "Brasil";

        const parsed = parseM3U(content, countryName);

        if (cancelled) return;

        setChannels((current) => {
          const merged = new Map();

          for (const channel of current) {
            if (channel.url) {
              merged.set(channel.url, channel);
            }
          }

          for (const channel of parsed) {
            if (channel.url) {
              merged.set(channel.url, channel);
            }
          }

          return Array.from(merged.values());
        });
      } catch (err) {
        console.error("Erro ao carregar playlist:", err);

        if (!cancelled) {
          setError(
            "Não foi possível carregar a lista automaticamente. " +
              "Verifique sua conexão ou tente novamente. " +
              "Alguns servidores podem bloquear acessos externos."
          );
        }
      } finally {
        if (!cancelled) setChannelLoading(false);
      }
    }

    loadPlaylist();

    return () => {
      cancelled = true;
    };
  }, [channelSource]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !playing?.url) return;

    let hls;

    video.pause();
    video.removeAttribute("src");
    video.load();

    if (
      isHlsUrl(playing.url) &&
      Hls.isSupported()
    ) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });

      hls.loadSource(playing.url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch((err) => {
          console.warn("A reprodução automática foi bloqueada:", err);
        });
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          console.error("Erro fatal no HLS:", data);
          setError(
            "Não foi possível reproduzir este canal. " +
              "Ele pode estar offline ou bloquear a reprodução."
          );
        }
      });
    } else {
      video.src = playing.url;

      video.play().catch((err) => {
        console.warn("A reprodução automática foi bloqueada:", err);
      });
    }

    return () => {
      if (hls) hls.destroy();

      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [playing]);

  const countries = useMemo(() => {
    const values = new Set(
      channels.map((channel) => channel.country).filter(Boolean)
    );

    return ["Todos", ...Array.from(values).sort()];
  }, [channels]);

  const filteredChannels = useMemo(() => {
    const term = search.toLowerCase().trim();

    return channels.filter((channel) => {
      const matchesSearch =
        !term ||
        channel.name.toLowerCase().includes(term) ||
        channel.category.toLowerCase().includes(term);

      const matchesCountry =
        selectedCountry === "Todos" ||
        channel.country === selectedCountry;

      return matchesSearch && matchesCountry;
    });
  }, [channels, search, selectedCountry]);

  const filteredSeries = useMemo(() => {
    const term = search.toLowerCase().trim();

    return series.filter((item) => {
      const title = (item.title || item.name || "").toLowerCase();
      const category = (item.category || "").toLowerCase();

      const matchesSearch =
        !term ||
        title.includes(term) ||
        category.includes(term);

      const matchesCategory =
        selectedCategory === "Todas" ||
        item.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [series, search, selectedCategory]);

  function toggleFavorite(item) {
    const id = String(item.id);

    setFavorites((current) =>
      current.includes(id)
        ? current.filter((favoriteId) => favoriteId !== id)
        : [...current, id]
    );
  }

  function openPlayer(item, type = "channel") {
    setError("");

    setPlaying({
      ...item,
      type,
      url:
        item.url ||
        item.stream_url ||
        item.video_url ||
        "",
      name:
        item.name ||
        item.title ||
        item.channel_name ||
        "Reproduzindo",
    });
  }

  function closePlayer() {
    setPlaying(null);
  }

  function openSeries(item) {
    setSelectedSeries(item);
    setSelectedEpisode(null);
    setSearch("");
  }

  function goHome() {
    setSelectedSeries(null);
    setSelectedEpisode(null);
    setSearch("");
  }

  const styles = `
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: #080a12;
      color: #f7f7fb;
      font-family: Arial, Helvetica, sans-serif;
    }

    button, input, select {
      font: inherit;
    }

    button {
      cursor: pointer;
    }

    .dv-app {
      min-height: 100vh;
      background:
        radial-gradient(ellipse at top, #17162e 0%, #080a12 52%);
    }

    .dv-header {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 16px 5%;
      background: rgba(8, 10, 18, .94);
      border-bottom: 1px solid #28283c;
      backdrop-filter: blur(14px);
    }

    .dv-logo {
      font-size: 27px;
      font-weight: 900;
      letter-spacing: -1.4px;
      color: #fff;
      cursor: pointer;
    }

    .dv-logo span {
      color: #a855f7;
    }

    .dv-nav {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .dv-nav button {
      color: #c9c7d8;
      border: 0;
      background: transparent;
      padding: 10px 13px;
      border-radius: 9px;
    }

    .dv-nav button.active,
    .dv-nav button:hover {
      background: #8b35ed;
      color: white;
    }

    .dv-main {
      max-width: 1400px;
      margin: auto;
      padding: 28px 5% 70px;
    }

    .dv-hero {
      padding: 38px 0 30px;
    }

    .dv-kicker {
      color: #c084fc;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 2px;
      text-transform: uppercase;
    }

    .dv-hero h1 {
      margin: 12px 0;
      font-size: clamp(30px, 5vw, 54px);
      line-height: 1.06;
    }

    .dv-hero p {
      max-width: 620px;
      color: #aaa9bc;
      line-height: 1.7;
    }

    .dv-search {
      width: 100%;
      max-width: 480px;
      padding: 14px 16px;
      color: white;
      background: #151624;
      border: 1px solid #343348;
      border-radius: 12px;
      outline: none;
    }

    .dv-search:focus {
      border-color: #a855f7;
    }

    .dv-filters {
      display: flex;
      gap: 9px;
      flex-wrap: wrap;
      align-items: center;
      margin: 18px 0 25px;
    }

    .dv-chip {
      color: #c9c7d8;
      background: #151624;
      border: 1px solid #343348;
      padding: 9px 13px;
      border-radius: 999px;
    }

    .dv-chip.active {
      background: #8b35ed;
      color: white;
      border-color: #8b35ed;
    }

    .dv-section-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin: 28px 0 18px;
    }

    .dv-section-title h2 {
      margin: 0;
      font-size: 23px;
    }

    .dv-muted {
      color: #a3a2b5;
      font-size: 13px;
    }

    .dv-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(175px, 1fr));
      gap: 19px;
    }

    .dv-card {
      min-width: 0;
      overflow: hidden;
      background: #141522;
      border: 1px solid #27283a;
      border-radius: 15px;
      transition: transform .2s, border-color .2s;
    }

    .dv-card:hover {
      transform: translateY(-4px);
      border-color: #a855f7;
    }

    .dv-poster {
      position: relative;
      width: 100%;
      aspect-ratio: 3 / 4;
      background: linear-gradient(145deg, #292344, #11121d);
      overflow: hidden;
    }

    .dv-poster img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .dv-card-body {
      padding: 12px;
    }

    .dv-card-body h3 {
      font-size: 15px;
      line-height: 1.4;
      margin: 0 0 7px;
      overflow-wrap: anywhere;
    }

    .dv-card-body p {
      margin: 0;
      color: #aaa9bc;
      font-size: 12px;
      line-height: 1.5;
    }

    .dv-action {
      width: 100%;
      margin-top: 12px;
      border: 0;
      border-radius: 9px;
      padding: 11px;
      color: white;
      background: #8b35ed;
      font-weight: 700;
    }

    .dv-action:hover {
      background: #a855f7;
    }

    .dv-fav {
      position: absolute;
      right: 9px;
      top: 9px;
      z-index: 2;
      border: 0;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      color: white;
      background: rgba(0, 0, 0, .65);
      font-size: 18px;
    }

    .dv-channel-logo {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      padding: 20px;
      background: linear-gradient(145deg, #20223a, #10111a);
    }

    .dv-channel-logo img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .dv-channel-placeholder {
      font-size: 36px;
      font-weight: 900;
      color: #c084fc;
      text-align: center;
    }

    .dv-select {
      color: white;
      background: #151624;
      border: 1px solid #343348;
      border-radius: 10px;
      padding: 11px;
      max-width: 100%;
    }

    .dv-notice {
      padding: 13px 15px;
      margin: 15px 0;
      border-radius: 10px;
      color: #fcd9a5;
      background: #332415;
      border: 1px solid #6e4820;
      line-height: 1.5;
    }

    .dv-back {
      border: 1px solid #343348;
      color: white;
      background: #151624;
      border-radius: 9px;
      padding: 10px 14px;
      margin-bottom: 20px;
    }

    .dv-detail {
      display: grid;
      grid-template-columns: minmax(190px, 290px) 1fr;
      gap: 25px;
      align-items: start;
    }

    .dv-detail > img {
      width: 100%;
      aspect-ratio: 3 / 4;
      object-fit: cover;
      border-radius: 15px;
      background: #171827;
    }

    .dv-episodes {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 12px;
      margin-top: 20px;
    }

    .dv-episode {
      text-align: left;
      border: 1px solid #343348;
      color: white;
      background: #151624;
      padding: 15px;
      border-radius: 11px;
    }

    .dv-episode:hover {
      border-color: #a855f7;
    }

    .dv-empty {
      color: #aaa9bc;
      padding: 35px 10px;
      text-align: center;
      line-height: 1.7;
    }

    .dv-footer {
      padding: 25px 5%;
      color: #85849a;
      border-top: 1px solid #252638;
      text-align: center;
      font-size: 12px;
    }

    .dv-player-overlay {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 18px;
      background: rgba(0, 0, 0, .92);
    }

    .dv-player-box {
      width: min(100%, 900px);
      max-height: 95vh;
      display: flex;
      flex-direction: column;
      background: #11121d;
      border: 1px solid #38354c;
      border-radius: 15px;
      overflow: hidden;
    }

    .dv-player-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      padding: 13px 16px;
    }

    .dv-player-top h3 {
      font-size: 15px;
      margin: 0;
    }

    .dv-close {
      color: white;
      border: 0;
      border-radius: 8px;
      background: #29283b;
      padding: 8px 12px;
    }

    .dv-video-wrap {
      display: flex;
      justify-content: center;
      background: #000;
      max-height: 78vh;
      min-height: 180px;
    }

    .dv-video {
      display: block;
      width: 100%;
      max-height: 78vh;
      background: black;
      object-fit: contain;
    }

    .dv-video.vertical {
      width: min(100%, 430px);
      aspect-ratio: 9 / 16;
      max-height: 78vh;
    }

    .dv-player-error {
      padding: 12px 16px;
      color: #fbbf24;
      font-size: 13px;
      line-height: 1.5;
    }

    @media (max-width: 650px) {
      .dv-header {
        padding: 13px 4%;
        align-items: flex-start;
        flex-direction: column;
        gap: 10px;
      }

      .dv-logo {
        font-size: 25px;
      }

      .dv-nav {
        width: 100%;
        overflow-x: auto;
        flex-wrap: nowrap;
      }

      .dv-nav button {
        white-space: nowrap;
        padding: 9px 11px;
      }

      .dv-main {
        padding: 15px 4% 45px;
      }

      .dv-hero {
        padding: 28px 0 18px;
      }

      .dv-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .dv-card-body {
        padding: 10px;
      }

      .dv-card-body h3 {
        font-size: 14px;
      }

      .dv-detail {
        grid-template-columns: 1fr;
      }

      .dv-detail > img {
        width: min(100%, 260px);
      }

      .dv-player-overlay {
        padding: 0;
      }

      .dv-player-box {
        width: 100%;
        max-height: 100dvh;
        height: 100dvh;
        border-radius: 0;
        border: 0;
      }

      .dv-video-wrap {
        flex: 1;
        min-height: 0;
        max-height: none;
      }

      .dv-video {
        max-height: 100%;
      }

      .dv-video.vertical {
        max-height: 100%;
      }
    }
  `;

  return (
    <div className="dv-app">
      <style>{styles}</style>

      <header className="dv-header">
        <div className="dv-logo" onClick={goHome}>
          DRAMO<span>VIX</span>
        </div>

        <nav className="dv-nav">
          <button
            className={activeTab === "series" ? "active" : ""}
            onClick={() => {
              setActiveTab("series");
              goHome();
            }}
          >
            Minisséries
          </button>

          <button
            className={activeTab === "movies" ? "active" : ""}
            onClick={() => {
              setActiveTab("movies");
              goHome();
            }}
          >
            Filmes
          </button>

          <button
            className={activeTab === "channels" ? "active" : ""}
            onClick={() => {
              setActiveTab("channels");
              goHome();
              setSearch("");
            }}
          >
            📺 Canais
          </button>

          <button
            className={activeTab === "favorites" ? "active" : ""}
            onClick={() => {
              setActiveTab("favorites");
              goHome();
            }}
          >
            ❤️ Favoritos
          </button>
        </nav>
      </header>

      <main className="dv-main">
        {!selectedSeries && (
          <section className="dv-hero">
            <div className="dv-kicker">
              Sempre tem uma nova história
            </div>

            <h1>
              Escolha seu <span style={{ color: "#c084fc" }}>clima</span>
            </h1>

            <p>
              Descubra minisséries, filmes e canais para assistir
              em um só lugar.
            </p>

            <input
              className="dv-search"
              type="search"
              placeholder={
                activeTab === "channels"
                  ? "Pesquisar canal..."
                  : "Pesquisar histórias..."
              }
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </section>
        )}

        {error && <div className="dv-notice">{error}</div>}

        {selectedSeries ? (
          <section>
            <button className="dv-back" onClick={goHome}>
              ← Voltar ao catálogo
            </button>

            <div className="dv-detail">
              <img
                src={selectedSeries.image || selectedSeries.cover_url || ""}
                alt={selectedSeries.title}
                onError={(event) => {
                  event.currentTarget.style.visibility = "hidden";
                }}
              />

              <div>
                <div className="dv-kicker">
                  {selectedSeries.category || "Minissérie"}
                </div>

                <h1>{selectedSeries.title}</h1>

                <p style={{ color: "#aaa9bc", lineHeight: 1.7 }}>
                  {selectedSeries.description ||
                    "Escolha um episódio para começar a assistir."}
                </p>

                <button
                  className="dv-action"
                  style={{ maxWidth: 220 }}
                  onClick={() => toggleFavorite(selectedSeries)}
                >
                  {favorites.includes(String(selectedSeries.id))
                    ? "♥ Remover dos favoritos"
                    : "♡ Adicionar aos favoritos"}
                </button>
              </div>
            </div>

            <div className="dv-section-title">
              <h2>Episódios</h2>
              <span className="dv-muted">
                {episodes.length} episódios
              </span>
            </div>

            {episodes.length > 0 ? (
              <div className="dv-episodes">
                {episodes.map((episode, index) => (
                  <button
                    key={episode.id || index}
                    className="dv-episode"
                    onClick={() => {
                      setSelectedEpisode(episode);

                      openPlayer(
                        {
                          ...episode,
                          name:
                            episode.title ||
                            `Episódio ${episode.episode_number || index + 1}`,
                          url:
                            episode.video_url ||
                            episode.stream_url ||
                            episode.url,
                        },
                        "episode"
                      );
                    }}
                  >
                    ▶️ Episódio{" "}
                    {episode.episode_number || index + 1}
                    <div className="dv-muted" style={{ marginTop: 7 }}>
                      {episode.title || "Assistir agora"}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="dv-empty">
                Nenhum episódio publicado para esta série.
              </div>
            )}
          </section>
        ) : activeTab === "channels" ? (
          <section>
            <div className="dv-section-title">
              <h2>📺 Canais de TV</h2>
              <span className="dv-muted">
                {filteredChannels.length} canais
              </span>
            </div>

            <div className="dv-filters">
              <button
                className={`dv-chip ${channelSource === "br" ? "active" : ""}`}
                onClick={() => {
                  setChannelSource("br");
                  setSelectedCountry("Todos");
                }}
              >
                🇧🇷 Brasil
              </button>

              <button
                className={`dv-chip ${channelSource === "world" ? "active" : ""}`}
                onClick={() => {
                  setChannelSource("world");
                  setSelectedCountry("Todos");
                }}
              >
                🌎 Lista mundial
              </button>

              <select
                className="dv-select"
                value={selectedCountry}
                onChange={(event) =>
                  setSelectedCountry(event.target.value)
                }
              >
                {countries.map((country) => (
                  <option key={country} value={country}>
                    {country === "Todos" ? "Todos os países" : country}
                  </option>
                ))}
              </select>

              <button
                className="dv-chip"
                onClick={() => {
                  setChannels([]);
                  setError("");
                  setChannelSource((current) =>
                    current === "br" ? "world" : "br"
                  );
                }}
              >
                🔄 Atualizar lista
              </button>
            </div>

            <p className="dv-muted">
              As playlists públicas podem conter canais indisponíveis.
              A reprodução depende do servidor de cada transmissão.
            </p>

            {channelLoading && (
              <div className="dv-empty">
                Carregando canais...
              </div>
            )}

            {!channelLoading && filteredChannels.length === 0 && (
              <div className="dv-empty">
                Nenhum canal encontrado.
                <br />
                Tente outra lista ou pesquise outro nome.
              </div>
            )}

            <div className="dv-grid">
              {filteredChannels.map((channel, index) => (
                <article
                  className="dv-card"
                  key={`${channel.id}-${channel.url || index}`}
                >
                  <div className="dv-poster">
                    <button
                      className="dv-fav"
                      aria-label="Favoritar canal"
                      onClick={() => toggleFavorite(channel)}
                    >
                      {favorites.includes(String(channel.id)) ? "♥" : "♡"}
                    </button>

                    <div className="dv-channel-logo">
                      {channel.logo ? (
                        <img
                          src={channel.logo}
                          alt={channel.name}
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                            const fallback =
                              event.currentTarget.parentElement?.querySelector(
                                ".dv-channel-placeholder"
                              );

                            if (fallback) fallback.style.display = "block";
                          }}
                        />
                      ) : null}

                      <div
                        className="dv-channel-placeholder"
                        style={{
                          display: channel.logo ? "none" : "block",
                        }}
                      >
                        {channel.name.slice(0, 2).toUpperCase()}
                      </div>
                    </div>
                  </div>

                  <div className="dv-card-body">
                    <h3>{channel.name}</h3>

                    <p>
                      {channel.country} · {channel.category}
                    </p>

                    <button
                      className="dv-action"
                      onClick={() => openPlayer(channel, "channel")}
                    >
                      ▶ Assistir
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : activeTab === "movies" ? (
          <section>
            <div className="dv-section-title">
              <h2>🎬 Filmes</h2>
              <span className="dv-muted">
                {movies.length} filmes
              </span>
            </div>

            {movies.length === 0 ? (
              <div className="dv-empty">
                Nenhum filme publicado ainda.
                <br />
                Adicione filmes à tabela movies no Supabase.
              </div>
            ) : (
              <div className="dv-grid">
                {movies
                  .filter((movie) =>
                    (movie.title || movie.name || "")
                      .toLowerCase()
                      .includes(search.toLowerCase())
                  )
                  .map((movie) => (
                    <article className="dv-card" key={movie.id}>
                      <div className="dv-poster">
                        <img
                          src={
                            movie.image ||
                            movie.poster_url ||
                            movie.cover_url ||
                            ""
                          }
                          alt={movie.title || movie.name}
                          loading="lazy"
                        />
                      </div>

                      <div className="dv-card-body">
                        <h3>{movie.title || movie.name}</h3>

                        <p>{movie.description || "Filme"}</p>

                        <button
                          className="dv-action"
                          onClick={() =>
                            openPlayer(
                              {
                                ...movie,
                                name: movie.title || movie.name,
                                url:
                                  movie.video_url ||
                                  movie.stream_url ||
                                  movie.url,
                              },
                              "movie"
                            )
                          }
                        >
                          ▶ Assistir
                        </button>
                      </div>
                    </article>
                  ))}
              </div>
            )}
          </section>
        ) : activeTab === "favorites" ? (
          <section>
            <div className="dv-section-title">
              <h2>❤️ Seus favoritos</h2>
            </div>

            {favorites.length === 0 ? (
              <div className="dv-empty">
                Você ainda não adicionou favoritos.
              </div>
            ) : (
              <div className="dv-grid">
                {[
                  ...series,
                  ...channels,
                  ...movies.map((movie) => ({
                    ...movie,
                    name: movie.title || movie.name,
                  })),
                ]
                  .filter((item) =>
                    favorites.includes(String(item.id))
                  )
                  .map((item) => (
                    <article className="dv-card" key={item.id}>
                      <div className="dv-poster">
                        {item.logo || item.image || item.cover_url ? (
                          <img
                            src={
                              item.logo ||
                              item.image ||
                              item.cover_url ||
                              ""
                            }
                            alt={item.name || item.title}
                          />
                        ) : (
                          <div className="dv-channel-logo">
                            <div className="dv-channel-placeholder">
                              {(
                                item.name ||
                                item.title ||
                                "DV"
                              )
                                .slice(0, 2)
                                .toUpperCase()}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="dv-card-body">
                        <h3>{item.name || item.title}</h3>

                        <button
                          className="dv-action"
                          onClick={() => {
                            if (item.url || item.stream_url) {
                              openPlayer(item);
                            } else {
                              openSeries(item);
                            }
                          }}
                        >
                          Abrir
                        </button>
                      </div>
                    </article>
                  ))}
              </div>
            )}
          </section>
        ) : (
          <section>
            <div className="dv-section-title">
              <h2>Escolha seu clima</h2>
              <span className="dv-muted">
                {filteredSeries.length} histórias
              </span>
            </div>

            <div className="dv-filters">
              {categories.map((category) => (
                <button
                  key={category}
                  className={`dv-chip ${
                    selectedCategory === category ? "active" : ""
                  }`}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>

            {loading && (
              <div className="dv-empty">
                Carregando catálogo...
              </div>
            )}

            {!loading && filteredSeries.length === 0 && (
              <div className="dv-empty">
                Nenhuma história encontrada.
              </div>
            )}

            <div className="dv-grid">
              {filteredSeries.map((item) => (
                <article className="dv-card" key={item.id}>
                  <div className="dv-poster">
                    <button
                      className="dv-fav"
                      aria-label="Favoritar série"
                      onClick={() => toggleFavorite(item)}
                    >
                      {favorites.includes(String(item.id)) ? "♥" : "♡"}
                    </button>

                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.title}
                        loading="lazy"
                      />
                    ) : (
                      <div className="dv-channel-logo">
                        <div className="dv-channel-placeholder">
                          DR
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="dv-card-body">
                    <p>{item.category || "Minissérie"}</p>

                    <h3>{item.title}</h3>

                    <p>{item.description || "Uma nova história espera por você."}</p>

                    <button
                      className="dv-action"
                      onClick={() => openSeries(item)}
                    >
                      ▶ Ver episódios
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="dv-footer">
        DRAMOVIX · Entretenimento em um só lugar
      </footer>

      {playing && (
        <div
          className="dv-player-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) closePlayer();
          }}
        >
          <div className="dv-player-box">
            <div className="dv-player-top">
              <h3>{playing.name}</h3>

              <button
                className="dv-close"
                onClick={closePlayer}
              >
                ✕ Fechar
              </button>
            </div>

            <div className="dv-video-wrap">
              <video
                ref={videoRef}
                className={
                  playing.type === "episode"
                    ? "dv-video vertical"
                    : "dv-video"
                }
                controls
                playsInline
                autoPlay
                preload="metadata"
              >
                Seu navegador não suporta vídeo.
              </video>
            </div>

            {error && (
              <div className="dv-player-error">
                {error}
              </div>
            )}

            <div className="dv-player-error">
              Se o canal não abrir, ele pode estar offline,
              bloquear reprodução fora do site original ou exigir
              um formato não compatível com este player.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
