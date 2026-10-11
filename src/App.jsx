import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import "./App.css";

const seriesCategories = [
  "Todas",
  "Romance",
  "Vingança",
  "Suspense",
  "Bilionários",
  "Casamento",
];

function getSavedFavorites() {
  try {
    return JSON.parse(
      localStorage.getItem("dramovix-favorites") || "[]"
    );
  } catch {
    return [];
  }
}

// URLs das listas do Brasil, estados e cidades selecionadas
const playlistUrls = [
  "https://iptv-org.github.io/iptv/countries/br.m3u",
  "https://iptv-org.github.io/iptv/subdivisions/br-sc.m3u",
  "https://iptv-org.github.io/iptv/subdivisions/br-sp.m3u",
  "https://iptv-org.github.io/iptv/subdivisions/br-rj.m3u",
  "https://iptv-org.github.io/iptv/subdivisions/br-mg.m3u",
  "https://iptv-org.github.io/iptv/cities/brbac.m3u",
  "https://iptv-org.github.io/iptv/cities/brsje.m3u",
  "https://iptv-org.github.io/iptv/cities/brsao.m3u",
  "https://iptv-org.github.io/iptv/cities/brrio.m3u"
];

export default function App() {
  const [currentTab, setCurrentTab] = useState("series"); // "series" | "movies" | "channels"
  const [dbSeries, setDbSeries] = useState([]);
  const [dbMovies, setDbMovies] = useState([]);
  const [dbChannels, setDbChannels] = useState([]);
  const [iptvChannels, setIptvChannels] = useState([]);
  const [loadingIptv, setLoadingIptv] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState("");
  const [seriesCategory, setSeriesCategory] = useState("Todas");
  const [channelCategory, setChannelCategory] = useState("Todas");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [episodesError, setEpisodesError] = useState("");
  const [playing, setPlaying] = useState(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [favorites, setFavorites] = useState(getSavedFavorites);

  // Carregar Séries
  useEffect(() => {
    let active = true;

    async function loadSeries() {
      setLoading(true);
      setDbError("");

      const { data, error } = await supabase
        .from("series")
        .select("*")
        .eq("published", true);

      if (!active) return;

      if (error) {
        console.error("Erro ao carregar séries:", error);
        setDbError(error.message);
        setLoading(false);
        return;
      }

      setDbSeries(
        (data || []).map((item) => ({
          id: `db-${item.id}`,
          dbId: item.id,
          title: item.title,
          category: item.genre || item.category || "Romance",
          description: item.description || "",
          image: item.cover_url || "",
          episodes: 0,
        }))
      );

      setLoading(false);
    }

    loadSeries();

    return () => {
      active = false;
    };
  }, []);

  // Carregar Filmes
  useEffect(() => {
    async function loadMovies() {
      const { data } = await supabase
        .from("movies")
        .select("*")
        .eq("published", true);

      if (data) {
        setDbMovies(
          data.map((item) => ({
            id: `movie-${item.id}`,
            dbId: item.id,
            title: item.title,
            category: item.category || "Filmes",
            description: item.description || "",
            image: item.cover_url || "",
            video_url: item.video_url || "",
          }))
        );
      }
    }
    loadMovies();
  }, []);

  // Carregar Canais do Supabase + Listas IPTV do GitHub com Categorias
  useEffect(() => {
    async function loadAllChannels() {
      // 1. Carrega do Supabase
      let customChannels = [];
      const { data } = await supabase
        .from("channels")
        .select("*")
        .eq("published", true);

      if (data) {
        customChannels = data.map((item) => ({
          id: `channel-${item.id}`,
          title: item.name || item.title,
          category: item.category || "Personalizado",
          description: item.description || "Canal de TV ao vivo",
          image: item.logo_url || "https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=500&auto=format&fit=crop&q=60",
          video_url: item.stream_url || item.video_url || "",
        }));
      }

      setDbChannels(customChannels);

      // 2. Carrega as listas IPTV e extrai categorias reais (group-title)
      setLoadingIptv(true);
      try {
        const allParsed = [];
        const seenUrls = new Set();

        for (const url of playlistUrls) {
          try {
            const response = await fetch(url);
            const text = await response.text();
            const lines = text.split("\n");
            let currentTitle = "";
            let currentLogo = "";
            let currentGroup = "Geral";

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              
              if (line.startsWith("#EXTINF:")) {
                const parts = line.split(",");
                currentTitle = parts[parts.length - 1] || "Canal IPTV";

                // Extrai o logotipo se houver
                const logoMatch = line.match(/tvg-logo="([^"]*)"/);
                currentLogo = logoMatch ? logoMatch[1] : "";

                // Extrai a categoria oficial do iptv-org (group-title)
                const groupMatch = line.match(/group-title="([^"]*)"/);
                currentGroup = groupMatch ? groupMatch[1] : "Geral";
              } else if (line && !line.startsWith("#")) {
                const streamUrl = line;
                
                if (currentTitle && streamUrl && !seenUrls.has(streamUrl)) {
                  seenUrls.add(streamUrl);
                  allParsed.push({
                    id: `iptv-${allParsed.length}`,
                    title: currentTitle.trim(),
                    category: currentGroup,
                    description: "Transmissão ao vivo via iptv-org",
                    image: currentLogo || "https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=500&auto=format&fit=crop&q=60",
                    video_url: streamUrl,
                  });
                }
                currentTitle = "";
                currentLogo = "";
                currentGroup = "Geral";
              }
            }
          } catch (subErr) {
            console.warn(`Erro ao carregar lista ${url}:`, subErr);
          }
        }

        setIptvChannels(allParsed);
      } catch (err) {
        console.warn("Erro ao processar listas IPTV.", err);
      } finally {
        setLoadingIptv(false);
      }
    }

    loadAllChannels();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "dramovix-favorites",
        JSON.stringify(favorites)
      );
    } catch (error) {
      console.warn("Não foi possível salvar favoritos.", error);
    }
  }, [favorites]);

  useEffect(() => {
    let active = true;

    async function loadEpisodes() {
      setEpisodes([]);
      setEpisodesError("");

      if (!selected?.dbId || currentTab !== "series") {
        setEpisodesLoading(false);
        return;
      }

      setEpisodesLoading(true);

      const { data, error } = await supabase
        .from("episodes")
        .select("*")
        .eq("series_id", selected.dbId)
        .order("episode_number", { ascending: true });

      if (!active) return;

      if (error) {
        console.error("Erro ao carregar episódios:", error);
        setEpisodesError(error.message);
      } else {
        setEpisodes(data || []);
      }

      setEpisodesLoading(false);
    }

    loadEpisodes();

    return () => {
      active = false;
    };
  }, [selected, currentTab]);

  const allChannelsList = [...dbChannels, ...iptvChannels];

  // Extrai lista única de categorias disponíveis nos canais carregados
  const availableChannelCategories = [
    "Todas",
    ...new Set(allChannelsList.map((item) => item.category))
  ];

  const catalog =
    currentTab === "movies"
      ? dbMovies
      : currentTab === "channels"
      ? allChannelsList
      : dbSeries;

  const filtered = catalog.filter((item) => {
    let matchesCategory = true;
    if (currentTab === "series") {
      matchesCategory = seriesCategory === "Todas" || item.category === seriesCategory;
    } else if (currentTab === "channels") {
      matchesCategory = channelCategory === "Todas" || item.category === channelCategory;
    }

    const matchesSearch = item.title
      .toLowerCase()
      .includes(search.trim().toLowerCase());

    const matchesFavorites =
      !showFavorites || favorites.includes(String(item.id));

    return matchesCategory && matchesSearch && matchesFavorites;
  });

  const featured = catalog[0] || null;

  function openItem(item) {
    if (currentTab === "channels" || currentTab === "movies") {
      setPlaying({ title: item.title, video_url: item.video_url });
    } else {
      setSelected(item);
      setPlaying(null);
      setEpisodes([]);
    }
  }

  function closeDetails() {
    setSelected(null);
    setPlaying(null);
    setEpisodes([]);
  }

  function toggleFavorite(item) {
    const id = String(item.id);
    setFavorites((current) =>
      current.includes(id)
        ? current.filter((favoriteId) => favoriteId !== id)
        : [...current, id]
    );
  }

  function playEpisode(episode) {
    if (!episode?.video_url) {
      alert("Este episódio ainda não tem um vídeo cadastrado.");
      return;
    }
    setPlaying(episode);
  }

  const visibleEpisodes = selected?.dbId ? episodes : [];

  function playNextEpisode() {
    if (!playing) return;
    const currentIndex = visibleEpisodes.findIndex(
      (episode) => String(episode.id) === String(playing.id)
    );

    if (currentIndex < 0) {
      setPlaying(null);
      return;
    }

    const nextEpisode = visibleEpisodes
      .slice(currentIndex + 1)
      .find((episode) => Boolean(episode.video_url));

    if (nextEpisode) {
      setPlaying(nextEpisode);
    } else {
      setPlaying(null);
    }
  }

  return (
    <div className="dv-app">
      <style>{`
        .dv-app {
          min-height: 100vh;
          background: #10091b;
          color: #fff;
          font-family: Inter, Arial, sans-serif;
        }
        .dv-app * { box-sizing: border-box; }
        .dv-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 18px 5%;
          background: #170d25;
          border-bottom: 1px solid #30203e;
          flex-wrap: wrap;
        }
        .dv-logo {
          color: #c084fc;
          font-size: 28px;
          font-weight: 900;
          letter-spacing: 2px;
          cursor: pointer;
        }
        .dv-nav-tabs {
          display: flex;
          gap: 8px;
        }
        .dv-nav-tab {
          background: #241532;
          border: 1px solid #49345c;
          color: #d8b4fe;
          padding: 8px 14px;
          border-radius: 16px;
          cursor: pointer;
          font-weight: 600;
        }
        .dv-nav-tab.active {
          background: #9333ea;
          color: #fff;
          border-color: #a855f7;
        }
        .dv-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .dv-search {
          width: min(260px, 100%);
          padding: 10px 14px;
          border: 1px solid #49345c;
          border-radius: 24px;
          background: #241532;
          color: white;
          outline: none;
        }
        .dv-main {
          width: 90%;
          max-width: 1400px;
          margin: auto;
        }
        .dv-section-title { font-size: 24px; margin: 0 0 8px; }
        .dv-subtitle { color: #b9a8c8; margin: 0 0 22px; }
        .dv-categories {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin: 20px 0 28px;
        }
        .dv-category {
          padding: 9px 16px;
          border-radius: 20px;
          background: #241532;
          color: #e9d5ff;
          border: 1px solid #49345c;
          cursor: pointer;
          font-size: 13px;
        }
        .dv-category.active {
          background: #7e22ce;
          border-color: #a855f7;
        }
        .dv-grid {
          display: grid;
          grid-template-columns: repeat(3,minmax(0,1fr));
          gap: 22px;
          padding-bottom: 48px;
        }
        .dv-card {
          min-width: 0;
          position: relative;
          background: #190f25;
          border: 1px solid #30203e;
          border-radius: 15px;
          overflow: hidden;
        }
        .dv-card-click {
          display: block;
          width: 100%;
          padding: 0;
          text-align: left;
          color: inherit;
          background: none;
          border: 0;
          cursor: pointer;
        }
        .dv-cover {
          width: 100%;
          aspect-ratio: 3/4;
          object-fit: cover;
          display: block;
          background: #2b1a39;
          transition: transform .2s;
        }
        .dv-card:hover .dv-cover { transform: scale(1.02); }
        .dv-card-content { padding: 13px; }
        .dv-card h3 { margin: 7px 0 6px; font-size: 16px; }
        .dv-tag {
          color: #c084fc;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
        }
        .dv-description {
          color: #c5b7d0;
          font-size: 13px;
          line-height: 1.5;
        }
        .dv-card-actions {
          display: flex;
          gap: 8px;
          padding: 0 13px 14px;
        }
        .dv-card-actions .dv-button {
          flex: 1;
          padding: 9px 10px;
        }
        .dv-heart {
          position: absolute;
          top: 10px;
          right: 10px;
          z-index: 2;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 1px solid #ffffff55;
          background: #170d25dd;
          color: white;
          font-size: 22px;
          cursor: pointer;
        }
        .dv-heart.saved { color: #fb7185; }
        .dv-message { padding: 20px 0; color: #c5b7d0; }
        .dv-button {
          cursor: pointer;
          border: 0;
          border-radius: 24px;
          padding: 11px 17px;
          background: #9333ea;
          color: white;
          font-weight: 700;
        }
        .dv-button:hover { background: #a855f7; }
        .dv-button.secondary {
          background: #30203e;
          border: 1px solid #624477;
        }
        .dv-button.active { background: #6d28d9; }
        .dv-footer {
          padding: 28px 5%;
          text-align: center;
          color: #8f7d9f;
          border-top: 1px solid #30203e;
        }
        .dv-player {
          position: fixed;
          inset: 0;
          z-index: 10;
          background: rgba(8,4,14,.96);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 24px;
          text-align: center;
          overflow: auto;
        }
        .dv-player-box {
          width: min(380px, 100%);
          background: #000;
          border: 1px solid #49345c;
          border-radius: 16px;
          overflow: hidden;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 0;
        }
        .dv-video {
          display: block;
          width: 100%;
          max-height: 80vh;
          aspect-ratio: 9 / 16;
          object-fit: contain;
          background: #000;
          border-radius: 10px;
        }
        @media(max-width:760px) {
          .dv-grid { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 14px; }
          .dv-header { align-items: flex-start; }
          .dv-search { width: 100%; }
        }
      `}</style>

      <header className="dv-header">
        <div
          className="dv-logo"
          onClick={() => {
            closeDetails();
            setShowFavorites(false);
          }}
        >
          DRAMOVIX
        </div>

        <div className="dv-nav-tabs">
          <button
            className={`dv-nav-tab ${currentTab === "series" ? "active" : ""}`}
            onClick={() => {
              setCurrentTab("series");
              closeDetails();
              setShowFavorites(false);
            }}
          >
            🎬 Minisséries
          </button>
          <button
            className={`dv-nav-tab ${currentTab === "movies" ? "active" : ""}`}
            onClick={() => {
              setCurrentTab("movies");
              closeDetails();
              setShowFavorites(false);
            }}
          >
            🍿 Filmes
          </button>
          <button
            className={`dv-nav-tab ${currentTab === "channels" ? "active" : ""}`}
            onClick={() => {
              setCurrentTab("channels");
              closeDetails();
              setShowFavorites(false);
            }}
          >
            📡 Canais
          </button>
        </div>

        <div className="dv-header-actions">
          <input
            className="dv-search"
            type="search"
            placeholder="Buscar..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setSelected(null);
              setPlaying(null);
            }}
          />

          <button
            className={`dv-button ${showFavorites ? "active" : "secondary"}`}
            onClick={() => {
              setShowFavorites((value) => !value);
              setSelected(null);
              setPlaying(null);
            }}
          >
            ♥ Favoritos ({favorites.length})
          </button>
        </div>
      </header>

      <main className="dv-main">
        {selected ? (
          <section className="dv-detail">
            {/* Detalhes de séries */}
          </section>
        ) : (
          <section>
            {/* Categorias de Minisséries */}
            {currentTab === "series" && !showFavorites && (
              <>
                <h2 className="dv-section-title">Categorias</h2>
                <div className="dv-categories">
                  {seriesCategories.map((item) => (
                    <button
                      key={item}
                      className={`dv-category ${
                        seriesCategory === item ? "active" : ""
                      }`}
                      onClick={() => setSeriesCategory(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Categorias de Canais (Extraídas automaticamente da lista IPTV) */}
            {currentTab === "channels" && !showFavorites && (
              <>
                <h2 className="dv-section-title">Categorias de Canais</h2>
                <div className="dv-categories">
                  {availableChannelCategories.map((item) => (
                    <button
                      key={item}
                      className={`dv-category ${
                        channelCategory === item ? "active" : ""
                      }`}
                      onClick={() => setChannelCategory(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </>
            )}

            <h2 className="dv-section-title" style={{ marginTop: 24 }}>
              {showFavorites
                ? "Seus favoritos"
                : currentTab === "series"
                ? "Minisséries disponíveis"
                : currentTab === "movies"
                ? "Filmes disponíveis"
                : "Canais ao vivo organizados"}
            </h2>

            <p className="dv-subtitle">
              {filtered.length} {filtered.length === 1 ? "item" : "itens"} encontrados
              {loadingIptv && currentTab === "channels" && " (Organizando categorias...)"}
            </p>

            <div className="dv-grid">
              {filtered.map((item) => {
                const isFavorite = favorites.includes(String(item.id));

                return (
                  <article className="dv-card" key={item.id}>
                    <button
                      className={`dv-heart ${isFavorite ? "saved" : ""}`}
                      aria-label="Favorito"
                      onClick={() => toggleFavorite(item)}
                    >
                      {isFavorite ? "♥" : "♡"}
                    </button>

                    <button
                      className="dv-card-click"
                      onClick={() => openItem(item)}
                    >
                      {item.image ? (
                        <img
                          className="dv-cover"
                          src={item.image}
                          alt={item.title}
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.style.visibility = "hidden";
                          }}
                        />
                      ) : (
                        <div className="dv-cover" />
                      )}

                      <div className="dv-card-content">
                        <span className="dv-tag">{item.category}</span>
                        <h3>{item.title}</h3>
                        <p className="dv-description">
                          {item.description}
                        </p>
                      </div>
                    </button>

                    <div className="dv-card-actions">
                      <button
                        className="dv-button"
                        onClick={() => openItem(item)}
                      >
                        ▶ Assistir
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {!loading && filtered.length === 0 && (
              <p className="dv-message">
                Nenhum conteúdo encontrado nesta categoria.
              </p>
            )}
          </section>
        )}
      </main>

      <footer className="dv-footer">
        DRAMOVIX · Suas histórias, do seu jeito.
      </footer>

      {playing && (
        <div className="dv-player">
          <button
            className="dv-button secondary"
            onClick={() => setPlaying(null)}
          >
            ✕ Fechar player
          </button>

          <h2>{playing.title}</h2>

          <div className="dv-player-box">
            {playing.video_url ? (
              <video
                key={playing.id || playing.video_url}
                className="dv-video"
                controls
                playsInline
                autoPlay
                ref={(el) => {
                  if (!el) return;
                  const videoUrl = playing.video_url;
                  
                  if (videoUrl.includes('.m3u8')) {
                    if (window.Hls && window.Hls.isSupported()) {
                      const hls = new window.Hls();
                      hls.loadSource(videoUrl);
                      hls.attachMedia(el);
                      window.currentHls = hls;
                    } else if (el.canPlayType('application/vnd.apple.mpegurl')) {
                      el.src = videoUrl;
                    }
                  } else {
                    el.src = videoUrl;
                  }
                }}
              >
                Seu navegador não conseguiu abrir este stream.
              </video>
            ) : (
              <p>Este vídeo não possui link de reprodução cadastrado.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
