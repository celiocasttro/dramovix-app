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
    <div className="dv-app" style={{ minHeight: "100vh", background: "#10091b", color: "#fff", fontFamily: "Inter, Arial, sans-serif" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", padding: "18px 5%", background: "#170d25", borderBottom: "1px solid #30203e", flexWrap: "wrap" }}>
        <div
          style={{ color: "#c084fc", fontSize: "28px", fontWeight: "900", letterSpacing: "2px", cursor: "pointer" }}
          onClick={() => {
            closeDetails();
            setShowFavorites(false);
          }}
        >
          DRAMOVIX
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            style={{ background: currentTab === "series" ? "#9333ea" : "#241532", border: "1px solid #49345c", color: currentTab === "series" ? "#fff" : "#d8b4fe", padding: "8px 14px", borderRadius: "16px", cursor: "pointer", fontWeight: "600" }}
            onClick={() => {
              setCurrentTab("series");
              closeDetails();
              setShowFavorites(false);
            }}
          >
            🎬 Minisséries
          </button>
          <button
            style={{ background: currentTab === "movies" ? "#9333ea" : "#241532", border: "1px solid #49345c", color: currentTab === "movies" ? "#fff" : "#d8b4fe", padding: "8px 14px", borderRadius: "16px", cursor: "pointer", fontWeight: "600" }}
            onClick={() => {
              setCurrentTab("movies");
              closeDetails();
              setShowFavorites(false);
            }}
          >
            🍿 Filmes
          </button>
          <button
            style={{ background: currentTab === "channels" ? "#9333ea" : "#241532", border: "1px solid #49345c", color: currentTab === "channels" ? "#fff" : "#d8b4fe", padding: "8px 14px", borderRadius: "16px", cursor: "pointer", fontWeight: "600" }}
            onClick={() => {
              setCurrentTab("channels");
              closeDetails();
              setShowFavorites(false);
            }}
          >
            📡 Canais
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <input
            style={{ width: "min(260px, 100%)", padding: "10px 14px", border: "1px solid #49345c", borderRadius: "24px", background: "#241532", color: "white", outline: "none" }}
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
            style={{ cursor: "pointer", border: 0, borderRadius: "24px", padding: "11px 17px", background: showFavorites ? "#6d28d9" : "#30203e", color: "white", fontWeight: "700" }}
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

      <main style={{ width: "90%", maxWidth: "1400px", margin: "auto" }}>
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
                style={{ cursor: "pointer", border: "1px solid #624477", borderRadius: "24px", padding: "11px 17px", background: "#30203e", color: "white", fontWeight: "700" }}
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
                  style={{ cursor: "pointer", border: 0, borderRadius: "24px", padding: "11px 17px", background: "#9333ea", color: "white", fontWeight: "700" }}
                  onClick={() => {
                    if (episodesLoading) {
                      alert("Aguarde: os episódios ainda estão carregando.");
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
                  style={{ cursor: "pointer", border: 0, borderRadius: "24px", padding: "11px 17px", background: favorites.includes(String(selected.id)) ? "#6d28d9" : "#30203e", color: "white", fontWeight: "700" }}
                  onClick={() => toggleFavorite(selected)}
                >
                  {favorites.includes(String(selected.id))
                    ? "♥ Remover dos favoritos"
                    : "♡ Adicionar aos favoritos"}
                </button>
              </div>

              <h2>Episódios</h2>

              {episodesLoading && (
                <p style={{ color: "#c5b7d0", padding: "20px 0" }}>Carregando episódios...</p>
              )}

              {episodesError && (
                <p style={{ color: "#fca5a5", fontSize: "13px" }}>
                  Não foi possível carregar os episódios: {episodesError}
                </p>
              )}

              {!episodesLoading &&
                !episodesError &&
                visibleEpisodes.length === 0 && (
                  <p style={{ color: "#c5b7d0", padding: "20px 0" }}>
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
                <h2 style={{ fontSize: "24px", margin: "24px 0 8px" }}>Categorias</h2>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", margin: "20px 0 28px" }}>
                  {seriesCategories.map((item) => (
                    <button
                      key={item}
                      style={{ padding: "9px 16px", borderRadius: "20px", background: seriesCategory === item ? "#7e22ce" : "#241532", color: "#e9d5ff", border: "1px solid #49345c", cursor: "pointer", fontSize: "13px" }}
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
                <h2 style={{ fontSize: "24px", margin: "24px 0 8px" }}>Categorias de Canais</h2>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", margin: "20px 0 28px" }}>
                  {availableChannelCategories.map((item) => (
                    <button
                      key={item}
                      style={{ padding: "9px 16px", borderRadius: "20px", background: channelCategory === item ? "#7e22ce" : "#241532", color: "#e9d5ff", border: "1px solid #49345c", cursor: "pointer", fontSize: "13px" }}
                      onClick={() => setChannelCategory(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </>
            )}

            <h2 style={{ fontSize: "24px", margin: "24px 0 8px" }}>
              {showFavorites
                ? "Seus favoritos"
                : currentTab === "series"
                ? "Minisséries disponíveis"
                : currentTab === "movies"
                ? "Filmes disponíveis"
                : "Canais ao vivo por categoria"}
            </h2>

            <p style={{ color: "#b9a8c8", margin: "0 0 22px" }}>
              {filtered.length} {filtered.length === 1 ? "item" : "itens"} encontrados
              {loadingIptv && currentTab === "channels" && " (Carregando e traduzindo categorias...)"}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "22px", paddingBottom: "48px" }}>
              {filtered.map((item) => {
                const isFavorite = favorites.includes(String(item.id));

                return (
                  <article style={{ minWidth: 0, position: "relative", background: "#190f25", border: "1px solid #30203e", borderRadius: "15px", overflow: "hidden" }} key={item.id}>
                    <button
                      style={{ position: "absolute", top: "10px", right: "10px", zIndex: 2, width: "40px", height: "40px", borderRadius: "50%", border: "1px solid #ffffff55", background: "#170d25dd", color: isFavorite ? "#fb7185" : "white", fontSize: "22px", cursor: "pointer" }}
                      aria-label="Favorito"
                      onClick={() => toggleFavorite(item)}
                    >
                      {isFavorite ? "♥" : "♡"}
                    </button>

                    <button
                      style={{ display: "block", width: "100%", padding: 0, textAlign: "left", color: "inherit", background: "none", border: 0, cursor: "pointer" }}
                      onClick={() => openItem(item)}
                    >
                      {item.image ? (
                        <img
                          style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", display: "block", background: "#2b1a39" }}
                          src={item.image}
                          alt={item.title}
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.style.visibility = "hidden";
                          }}
                        />
                      ) : (
                        <div style={{ width: "100%", aspectRatio: "3/4", background: "#2b1a39" }} />
                      )}

                      <div style={{ padding: "13px" }}>
                        <span style={{ color: "#c084fc", fontSize: "11px", fontWeight: "800", textTransform: "uppercase" }}>{item.category}</span>
                        <h3 style={{ margin: "7px 0 6px", fontSize: "16px" }}>{item.title}</h3>
                        <p style={{ color: "#c5b7d0", fontSize: "13px", lineHeight: "1.5" }}>
                          {item.description}
                        </p>
                      </div>
                    </button>

                    <div style={{ display: "flex", gap: "8px", padding: "0 13px 14px" }}>
                      <button
                        style={{ cursor: "pointer", border: 0, borderRadius: "24px", padding: "9px 10px", background: "#9333ea", color: "white", fontWeight: "700", flex: 1 }}
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
              <p style={{ color: "#c5b7d0", padding: "20px 0" }}>
                Nenhum conteúdo encontrado nesta categoria.
              </p>
            )}
          </section>
        )}
      </main>

      <footer style={{ padding: "28px 5%", textAlign: "center", color: "#8f7d9f", borderTop: "1px solid #30203e" }}>
        DRAMOVIX · Suas histórias, do seu jeito.
      </footer>

      {playing && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10, background: "rgba(8,4,14,.96)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", padding: "24px", textAlign: "center", overflow: "auto" }}>
          <button
            style={{ cursor: "pointer", border: "1px solid #624477", borderRadius: "24px", padding: "11px 17px", background: "#30203e", color: "white", fontWeight: "700" }}
            onClick={() => setPlaying(null)}
          >
            ✕ Fechar player
          </button>

          <h2>{playing.title}</h2>

          <div style={{ width: "min(380px, 100%)", background: "#000", border: "1px solid #49345c", borderRadius: "16px", overflow: "hidden", display: "flex", justifyContent: "center", alignItems: "center", padding: 0 }}>
            {playing.video_url ? (
              <video
                key={playing.id || playing.video_url}
                style={{ display: "block", width: "100%", maxHeight: "80vh", aspectRatio: "9 / 16", objectFit: "contain", background: "#000", borderRadius: "10px" }}
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
              <p style={{ color: "#d8cce2", lineHeight: "1.6", padding: "20px" }}>Este vídeo não possui link de reprodução cadastrado.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
