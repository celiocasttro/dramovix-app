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

const categoryTranslations = {
  "Animation": "Animação",
  "Auto": "Automobilismo",
  "Business": "Negócios",
  "Classic": "Clássicos",
  "Comedy": "Comédia",
  "Cooking": "Culinária",
  "Culture": "Cultura",
  "Documentary": "Documentários",
  "Education": "Educação",
  "Entertainment": "Entretenimento",
  "Family": "Família",
  "General": "Geral",
  "Interactive": "Interativo",
  "Kids": "Infantil",
  "Legislative": "Legislativo",
  "Lifestyle": "Estilo de Vida",
  "Movies": "Filmes",
  "Music": "Música",
  "News": "Notícias",
  "Outdoor": "Ao Ar Livre",
  "Public": "Público",
  "Relax": "Relaxamento",
  "Religious": "Religioso",
  "Science": "Ciência",
  "Series": "Séries",
  "Shop": "Compras",
  "Sports": "Esportes",
  "Travel": "Viagem",
  "Weather": "Previsão do Tempo",
  "Undefined": "Indefinido"
};

const categoryPlaylistUrls = [
  { name: "Animation", url: "https://iptv-org.github.io/iptv/categories/animation.m3u" },
  { name: "Auto", url: "https://iptv-org.github.io/iptv/categories/auto.m3u" },
  { name: "Business", url: "https://iptv-org.github.io/iptv/categories/business.m3u" },
  { name: "Classic", url: "https://iptv-org.github.io/iptv/categories/classic.m3u" },
  { name: "Comedy", url: "https://iptv-org.github.io/iptv/categories/comedy.m3u" },
  { name: "Cooking", url: "https://iptv-org.github.io/iptv/categories/cooking.m3u" },
  { name: "Culture", url: "https://iptv-org.github.io/iptv/categories/culture.m3u" },
  { name: "Documentary", url: "https://iptv-org.github.io/iptv/categories/documentary.m3u" },
  { name: "Education", url: "https://iptv-org.github.io/iptv/categories/education.m3u" },
  { name: "Entertainment", url: "https://iptv-org.github.io/iptv/categories/entertainment.m3u" },
  { name: "Family", url: "https://iptv-org.github.io/iptv/categories/family.m3u" },
  { name: "General", url: "https://iptv-org.github.io/iptv/categories/general.m3u" },
  { name: "Kids", url: "https://iptv-org.github.io/iptv/categories/kids.m3u" },
  { name: "Lifestyle", url: "https://iptv-org.github.io/iptv/categories/lifestyle.m3u" },
  { name: "Movies", url: "https://iptv-org.github.io/iptv/categories/movies.m3u" },
  { name: "Music", url: "https://iptv-org.github.io/iptv/categories/music.m3u" },
  { name: "News", url: "https://iptv-org.github.io/iptv/categories/news.m3u" },
  { name: "Series", url: "https://iptv-org.github.io/iptv/categories/series.m3u" },
  { name: "Sports", url: "https://iptv-org.github.io/iptv/categories/sports.m3u" },
  { name: "Travel", url: "https://iptv-org.github.io/iptv/categories/travel.m3u" }
];

export default function App() {
  const [currentTab, setCurrentTab] = useState("series");
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

  useEffect(() => {
    async function loadAllChannels() {
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

      setLoadingIptv(true);
      try {
        const allParsed = [];
        const seenUrls = new Set();

        for (const cat of categoryPlaylistUrls) {
          try {
            const response = await fetch(cat.url);
            const text = await response.text();
            const lines = text.split("\n");
            let currentTitle = "";
            let currentLogo = "";
            const translatedCatName = categoryTranslations[cat.name] || cat.name;

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              
              if (line.startsWith("#EXTINF:")) {
                const parts = line.split(",");
                currentTitle = parts[parts.length - 1] || "Canal IPTV";

                const logoMatch = line.match(/tvg-logo="([^"]*)"/);
                currentLogo = logoMatch ? logoMatch[1] : "";
              } else if (line && !line.startsWith("#")) {
                const streamUrl = line;
                
                if (currentTitle && streamUrl && !seenUrls.has(streamUrl)) {
                  seenUrls.add(streamUrl);
                  allParsed.push({
                    id: `iptv-${allParsed.length}`,
                    title: currentTitle.trim(),
                    category: translatedCatName,
                    description: `Transmissão de ${translatedCatName}`,
                    image: currentLogo || "https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=500&auto=format&fit=crop&q=60",
                    video_url: streamUrl,
                  });
                }
                currentTitle = "";
                currentLogo = "";
              }
            }
          } catch (subErr) {
            console.warn(subErr);
          }
        }

        setIptvChannels(allParsed);
      } catch (err) {
        console.warn(err);
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
      console.warn(error);
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
          gap: 8px;
          margin: 20px 0 28px;
        }
        .dv-category {
          padding: 8px 14px;
          border-radius: 20px;
          background: #241532;
          color: #e9d5ff;
          border: 1px solid #49345c;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
        }
        .dv-category.active {
          background: #7e22ce;
          border-color: #a855f7;
        }
        .dv-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
          padding-bottom: 48px;
        }
        .dv-card {
          min-width: 0;
          position: relative;
          background: #190f25;
          border: 1px solid #30203e;
          border-radius: 15px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
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
          flex: 1;
        }
        .dv-cover {
          width: 100%;
          aspect-ratio: 3/4;
          object-fit: cover;
          display: block;
          background: #2b1a39;
        }
        .dv-card-content { padding: 12px; }
        .dv-card h3 { margin: 6px 0 4px; font-size: 15px; }
        .dv-tag {
          color: #c084fc;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
        }
        .dv-description {
          color: #c5b7d0;
          font-size: 12px;
          line-height: 1.4;
        }
        .dv-card-actions {
          padding: 0 12px 14px;
        }
        .dv-card-actions .dv-button {
          width: 100%;
          padding: 10px;
        }
        .dv-heart {
          position: absolute;
          top: 10px;
          right: 10px;
          z-index: 2;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 1px solid #ffffff55;
          background: #170d25dd;
          color: white;
          font-size: 20px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
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
        @media(max-width: 760px) {
          .dv-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
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
            placeholder="Pesquisar..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setSelected(null);
              setPlaying(null);
            }}
          />

          <button
            className={`dv-button ${showFavorites ? "" : "secondary"}`}
            style={{ background: showFavorites ? "#6d28d9" : "#30203e" }}
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
          <section style={{ margin: "30px 0 50px", display: "grid", gridTemplateColumns: "minmax(180px,300px) minmax(0,1fr)", gap: "28px" }}>
            <div>
              {selected.image ? (
                <img
                  style={{ width: "100%", borderRadius: "16px" }}
                  src={selected.image}
                  alt={selected.title}
                />
              ) : (
                <div style={{ background: "#000", padding: "20px", borderRadius: "16px" }}>Capa indisponível</div>
              )}
            </div>

            <div>
              <button
                className="dv-button secondary"
                onClick={closeDetails}
              >
                ← Voltar ao catálogo
              </button>

              <p style={{ color: "#d8b4fe", fontSize: "12px", fontWeight: "800", letterSpacing: "2px", marginTop: "20px" }}>
                {selected.category}
              </p>

              <h1 style={{ margin: "8px 0" }}>{selected.title}</h1>
              <p style={{ color: "#c5b7d0", fontSize: "13px", lineHeight: "1.5" }}>{selected.description}</p>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", margin: "18px 0" }}>
                <button
                  className="dv-button"
                  onClick={() => {
                    if (episodesLoading) {
                      alert("Aguarde: os episódios ainda estão a carregar.");
                      return;
                    }

                    const firstPlayable = visibleEpisodes.find(
                      (episode) => Boolean(episode.video_url)
                    );

                    if (firstPlayable) {
                      playEpisode(firstPlayable);
                    } else {
                      alert(
                        "Esta série ainda não tem episódios com vídeos cadastrados."
                      );
                    }
                  }}
                >
                  ▶ Assistir
                </button>

                <button
                  className="dv-button secondary"
                  style={{ background: favorites.includes(String(selected.id)) ? "#6d28d9" : "#30203e" }}
                  onClick={() => toggleFavorite(selected)}
                >
                  {favorites.includes(String(selected.id))
                    ? "♥ Remover dos favoritos"
                    : "♡ Adicionar aos favoritos"}
                </button>
              </div>

              <h2>Episódios</h2>

              {episodesLoading && (
                <p className="dv-message">A carregar episódios...</p>
              )}

              {episodesError && (
                <p style={{ color: "#fca5a5", fontSize: "13px" }}>
                  Não foi possível carregar os episódios: {episodesError}
                </p>
              )}

              {!episodesLoading &&
                !episodesError &&
                visibleEpisodes.length === 0 && (
                  <p className="dv-message">
                    Ainda não há episódios cadastrados para esta série.
                  </p>
                )}

              {visibleEpisodes.map((episode) => (
                <button
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", width: "100%", textAlign: "left", margin: "8px 0", padding: "14px", background: "#241532", color: "white", border: "1px solid #49345c", borderRadius: "10px", cursor: "pointer" }}
                  key={episode.id}
                  onClick={() => playEpisode(episode)}
                >
                  <span>
                    ▶ Episódio {episode.episode_number}
                    {episode.title ? ` — ${episode.title}` : ""}
                  </span>
                  <small style={{ color: "#c5b7d0" }}>
                    {episode.video_url
                      ? "Assistir"
                      : "Vídeo não conectado"}
                  </small>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section>
            {currentTab === "series" && !showFavorites && (
              <>
                <h2 className="dv-section-title" style={{ marginTop: 24 }}>Categorias</h2>
                <div className="dv-categories">
                  {seriesCategories.map((item) => (
                    <button
                      key={item}
                      className={`dv-category ${seriesCategory === item ? "active" : ""}`}
                      onClick={() => setSeriesCategory(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </>
            )}

            {currentTab === "channels" && !showFavorites && (
              <>
                <h2 className="dv-section-title" style={{ marginTop: 24 }}>Categorias de Canais</h2>
                <div className="dv-categories">
                  {availableChannelCategories.map((item) => (
                    <button
                      key={item}
                      className={`dv-category ${channelCategory === item ? "active" : ""}`}
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
                ? "Os seus favoritos"
                : currentTab === "series"
                ? "Minisséries disponíveis"
                : currentTab === "movies"
                ? "Filmes disponíveis"
                : "Canais ao vivo por categoria"}
            </h2>

            <p className="dv-subtitle">
              {filtered.length} {filtered.length === 1 ? "item encontrado" : "itens encontrados"}
              {loadingIptv && currentTab === "channels" && " (A carregar categorias...)"}
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
                        ▶ {currentTab === "series" ? "Ver série" : "Assistir"}
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
        DRAMOVIX · As suas histórias, à sua maneira.
      </footer>

      {playing && (
        <div className="dv-player">
          <button
            className="dv-button secondary"
            onClick={() => setPlaying(null)}
          >
            ✕ Fechar leitor
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
                O seu browser não conseguiu abrir este stream.
              </video>
            ) : (
              <p className="dv-message">Este vídeo não possui link de reprodução cadastrado.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
