import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import Hls from "hls.js";
import "./App.css";

const CHRIS_TITLE = "Todo Mundo Odeia o Chris";

const CHRIS_COVER =
  "https://svinrjrlrlitipleiccb.supabase.co/storage/v1/object/public/dramovix-videos/Capas/CHRIS%20TEMP4.png";

const DEFAULT_COVER =
  "https://placehold.co/600x800/171717/ffffff?text=DRAMOVIX";

const DEFAULT_MOVIE_COVER =
  "https://placehold.co/600x800/171717/ffffff?text=FILME";

const CHRIS_EPISODES = Array.from({ length: 22 }, (_, index) => ({
  id: `chris-s4-e${index + 1}`,
  title: `Episódio ${index + 1}`,
  episode_number: index + 1,
  season_number: 4,
  video_url: "https://cdnst70.tokyvideo.com/videos/636/636141/mp4/06a9d3ea52f2ca3c622c0f908ae3464fe7fa47d698f411e856f893710cba423a.mp4?secure=sdPb9xRPETR-6T9mmqr2Uw%3D%3D%2C1791942986",
  isChrisEpisode: true,
}));

const CHRIS_SERIES = {
  id: "dramovix-chris",
  title: CHRIS_TITLE,
  category: "Comédia",
  description:
    "Acompanhe as aventuras e confusões de Chris e sua família na quarta temporada.",
  image: CHRIS_COVER,
  isChris: true,
  episodes: CHRIS_EPISODES,
};

const LIVE_SERIES = {
  id: "dramovix-live-z-nation",
  title: "Z Nation",
  category: "Ao vivo",
  description: "Configure aqui uma transmissão ao vivo autorizada.",
  image: DEFAULT_COVER,
  video_url: "",
  isLive: true,
};

const normalize = (value = "") =>
  value
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export default function App() {
  const [section, setSection] = useState("inicio");

  const [series, setSeries] = useState([]);
  const [movies, setMovies] = useState([]);

  const [selectedSeries, setSelectedSeries] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [selectedEpisode, setSelectedEpisode] = useState(null);

  const [showDescription, setShowDescription] = useState(false);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");

  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("dramovix-favorites") || "[]"
      );
    } catch {
      return [];
    }
  });

  const [loading, setLoading] = useState(true);
  const [episodesLoading, setEpisodesLoading] = useState(false);

  const [playerOpen, setPlayerOpen] = useState(false);
  const [playerError, setPlayerError] = useState("");
  const [currentVideo, setCurrentVideo] = useState(null);

  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(
      "dramovix-favorites",
      JSON.stringify(favorites)
    );
  }, [favorites]);

  useEffect(() => {
    loadCatalog();
  }, []);

  async function loadCatalog() {
    setLoading(true);

    try {
      const [seriesResult, moviesResult] = await Promise.all([
        supabase
          .from("series")
          .select("*")
          .eq("published", true)
          .order("created_at", { ascending: false }),

        supabase
          .from("movies")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

      if (seriesResult.error) {
        console.error("Erro ao carregar séries:", seriesResult.error);
      }

      if (moviesResult.error) {
        console.error("Erro ao carregar filmes:", moviesResult.error);
      }

      const dbSeries = (seriesResult.data || []).map((item) => {
        const isChris =
          normalize(item.title) === normalize(CHRIS_TITLE);

        return {
          ...item,
          id: `db-${item.id}`,
          dbId: item.id,
          title: item.title,
          category: isChris ? "Comédia" : item.genre || "Romance",
          description: item.description || "",
          image: isChris
            ? CHRIS_COVER
            : item.cover_url || DEFAULT_COVER,
          isChris,
        };
      });

      const hasChris = dbSeries.some(
        (item) => normalize(item.title) === normalize(CHRIS_TITLE)
      );

      const catalogSeries = hasChris
        ? dbSeries
        : [...dbSeries, CHRIS_SERIES];

      setSeries(catalogSeries);

      setMovies(
        (moviesResult.data || []).map((item) => ({
          ...item,
          id: `movie-${item.id}`,
          title: item.title,
          image: item.cover_url || item.image || DEFAULT_MOVIE_COVER,
          video_url: item.video_url || "",
          type: "movie",
        }))
      );
    } catch (error) {
      console.error("Erro ao carregar catálogo:", error);
      setSeries([CHRIS_SERIES]);
      setMovies([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedSeries) {
      setEpisodes([]);
      setEpisodesLoading(false);
      return;
    }

    let cancelled = false;

    async function loadEpisodes() {
      setEpisodesLoading(true);

      try {
        if (selectedSeries.isChris) {
          if (!cancelled) {
            setEpisodes(CHRIS_EPISODES);
          }
          return;
        }

        const dbId =
          selectedSeries.dbId ||
          (String(selectedSeries.id).startsWith("db-")
            ? String(selectedSeries.id).replace("db-", "")
            : null);

        if (!dbId) {
          if (!cancelled) {
            setEpisodes([]);
          }
          return;
        }

        const { data, error } = await supabase
          .from("episodes")
          .select("*")
          .eq("series_id", dbId)
          .order("episode_number", { ascending: true });

        if (error) {
          throw error;
        }

        if (!cancelled) {
          setEpisodes(data || []);
        }
      } catch (error) {
        console.error("Erro ao carregar episódios:", error);

        if (!cancelled) {
          setEpisodes([]);
        }
      } finally {
        if (!cancelled) {
          setEpisodesLoading(false);
        }
      }
    }

    loadEpisodes();

    return () => {
      cancelled = true;
    };
  }, [selectedSeries]);

  function isFavorite(item) {
    return favorites.some(
      (favorite) => String(favorite.id) === String(item.id)
    );
  }

  function toggleFavorite(item) {
    setFavorites((previous) => {
      const exists = previous.some(
        (favorite) => String(favorite.id) === String(item.id)
      );

      if (exists) {
        return previous.filter(
          (favorite) => String(favorite.id) !== String(item.id)
        );
      }

      return [
        ...previous,
        {
          id: item.id,
          title: item.title,
          image: item.image || DEFAULT_COVER,
          category: item.category || "Filme",
          type: item.type || (item.isLive ? "live" : "series"),
          description: item.description || "",
        },
      ];
    });
  }

  function openSeries(item) {
    setSelectedSeries(item);
    setShowDescription(false);
    setSection("detalhes");
    setSearch("");
  }

  function openPlayer(item, type = "movie") {
    const videoUrl =
      item.video_url ||
      item.stream_url ||
      item.url ||
      item.video ||
      "";

    if (!videoUrl.trim()) {
      setPlayerError(
        "Este vídeo ainda não possui um endereço configurado. Adicione um link de vídeo autorizado para reproduzi-lo."
      );

      setCurrentVideo({ ...item, type });
      setPlayerOpen(true);
      return;
    }

    setPlayerError("");
    setCurrentVideo({
      ...item,
      video_url: videoUrl,
      type,
    });
    setPlayerOpen(true);
  }

  function openEpisode(episode) {
    setSelectedEpisode(episode);

    if (!episode.video_url) {
      setPlayerError(
        "O endereço de vídeo deste episódio ainda não foi configurado."
      );

      setCurrentVideo({
        ...episode,
        title: `${selectedSeries?.title || CHRIS_TITLE} — ${episode.title}`,
        type: "episode",
      });

      setPlayerOpen(true);
      return;
    }

    openPlayer(
      {
        ...episode,
        title: `${selectedSeries?.title || CHRIS_TITLE} — ${episode.title}`,
      },
      "episode"
    );
  }

  function playNextEpisode() {
    if (!currentVideo || !selectedSeries) {
      return;
    }

    const currentNumber =
      currentVideo.episode_number ?? currentVideo.episodeNumber;

    const nextEpisode = episodes.find(
      (episode) =>
        Number(episode.episode_number) === Number(currentNumber) + 1
    );

    if (nextEpisode) {
      openEpisode(nextEpisode);
    }
  }

  function closePlayer() {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }

    setPlayerOpen(false);
    setCurrentVideo(null);
    setSelectedEpisode(null);
    setPlayerError("");
  }

  useEffect(() => {
    if (!playerOpen || !currentVideo || playerError) {
      return;
    }

    const video = videoRef.current;
    const url = currentVideo.video_url;

    if (!video || !url) {
      return;
    }

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (url.includes(".m3u8")) {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url;
      } else if (Hls.isSupported()) {
        const hls = new Hls();
        hlsRef.current = hls;

        hls.loadSource(url);
        hls.attachMedia(video);

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            setPlayerError(
              "Não foi possível reproduzir este vídeo. Verifique o endereço e as permissões de acesso."
            );
          }
        });
      } else {
        setPlayerError(
          "Este navegador não suporta este formato de vídeo."
        );
      }
    } else {
      video.src = url;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [playerOpen, currentVideo, playerError]);

  const allSeries = [
    ...series.filter((item) => !item.isLive),
    LIVE_SERIES,
  ];

  const categories = [
    "Todas",
    ...new Set(
      allSeries
        .filter((item) => !item.isLive)
        .map((item) => item.category || "Romance")
    ),
  ];

  const filteredSeries = allSeries.filter((item) => {
    const matchesSearch = normalize(item.title).includes(
      normalize(search)
    );

    const matchesCategory =
      category === "Todas" || item.category === category;

    return matchesSearch && matchesCategory && !item.isLive;
  });

  const filteredMovies = movies.filter((movie) =>
    normalize(movie.title).includes(normalize(search))
  );

  const favoriteSeries = favorites.filter(
    (item) => item.type === "series" || !item.type
  );

  const favoriteMovies = favorites.filter(
    (item) => item.type === "movie"
  );

  function renderCard(item, type = "series") {
    const live = Boolean(item.isLive);
    const favorite = isFavorite(item);

    function handleOpen() {
      if (live) {
        openPlayer(item, "live");
      } else if (type === "movie") {
        openPlayer(item, "movie");
      } else {
        openSeries(item);
      }
    }

    return (
      <article className="dv-card" key={`${type}-${item.id}`}>
        <button
          className="dv-cover-button"
          onClick={handleOpen}
          aria-label={`Abrir ${item.title}`}
        >
          <img
            className="dv-cover"
            src={item.image || DEFAULT_COVER}
            alt={item.title}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src =
                type === "movie" ? DEFAULT_MOVIE_COVER : DEFAULT_COVER;
            }}
          />

          <span className="dv-play-icon">▶</span>

          {live && (
            <span className="dv-live-badge">AO VIVO</span>
          )}
        </button>

        <div className="dv-card-info">
          <span className="dv-card-category">
            {item.category || (type === "movie" ? "Filme" : "Série")}
          </span>

          <h3 title={item.title}>{item.title}</h3>

          <button
            className="dv-primary-button"
            onClick={handleOpen}
          >
            {live
              ? "Assistir ao vivo"
              : type === "movie"
                ? "Assistir"
                : "Ver episódios"}
          </button>

          <button
            className={`dv-favorite-button ${favorite ? "active" : ""}`}
            onClick={() => toggleFavorite(item)}
          >
            {favorite ? "♥ Favorito" : "♡ Favoritar"}
          </button>
        </div>
      </article>
    );
  }

  function renderGrid(items, type = "series") {
    if (!items.length) {
      return (
        <p className="dv-empty">
          Nenhum título encontrado.
        </p>
      );
    }

    return (
      <div className="dv-grid">
        {items.map((item) => renderCard(item, type))}
      </div>
    );
  }

  return (
    <div className="dv-app">
      <header className="dv-header">
        <button
          className="dv-logo"
          onClick={() => {
            setSection("inicio");
            setSelectedSeries(null);
            setShowDescription(false);
          }}
        >
          DRAMOVIX<span>+</span>
        </button>

        <div className="dv-search">
          <input
            type="search"
            placeholder="Buscar séries e filmes..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Buscar séries e filmes"
          />
        </div>
      </header>

      <nav className="dv-nav">
        {[
          ["inicio", "Início"],
          ["series", "Minisséries"],
          ["movies", "Filmes"],
          ["live", "Ao vivo"],
          ["favorites", `Favoritos (${favorites.length})`],
        ].map(([key, label]) => (
          <button
            key={key}
            className={section === key ? "selected" : ""}
            onClick={() => {
              setSection(key);
              setSelectedSeries(null);
              setShowDescription(false);
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="dv-main">
        {loading && (
          <p className="dv-empty">
            Carregando catálogo...
          </p>
        )}

        {!loading && section === "inicio" && (
          <>
            <section className="dv-hero">
              <div>
                <span className="dv-eyebrow">DRAMOVIX</span>

                <h1>Sempre tem uma nova história.</h1>

                <p>
                  Escolha seu clima e descubra o que assistir.
                </p>

                <button
                  className="dv-primary-button"
                  onClick={() => setSection("series")}
                >
                  Explorar catálogo
                </button>
              </div>
            </section>

            <section className="dv-section">
              <h2>Escolha seu clima</h2>

              <div className="dv-categories">
                {categories.map((item) => (
                  <button
                    key={item}
                    className={category === item ? "selected" : ""}
                    onClick={() => {
                      setCategory(item);
                      setSection("series");
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </section>

            <section className="dv-section">
              <h2>Em destaque</h2>

              {renderGrid(
                filteredSeries
                  .filter((item) => !item.isLive)
                  .slice(0, 8)
              )}
            </section>

            <section className="dv-section">
              <h2>Filmes</h2>

              {renderGrid(
                filteredMovies.slice(0, 4),
                "movie"
              )}
            </section>
          </>
        )}

        {!loading && section === "series" && (
          <section className="dv-section">
            <h1>Minisséries</h1>

            <div className="dv-categories">
              {categories.map((item) => (
                <button
                  key={item}
                  className={category === item ? "selected" : ""}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>

            {renderGrid(filteredSeries)}
          </section>
        )}

        {!loading && section === "movies" && (
          <section className="dv-section">
            <h1>Filmes</h1>

            {renderGrid(filteredMovies, "movie")}
          </section>
        )}

        {!loading && section === "live" && (
          <section className="dv-section">
            <h1>Ao vivo</h1>

            {renderGrid([LIVE_SERIES])}
          </section>
        )}

        {!loading && section === "favorites" && (
          <section className="dv-section">
            <h1>Meus favoritos</h1>

            <h2>Séries</h2>

            {renderGrid(favoriteSeries)}

            <h2>Filmes</h2>

            {renderGrid(favoriteMovies, "movie")}
          </section>
        )}

        {section === "detalhes" && selectedSeries && (
          <section className="dv-details">
            <button
              className="dv-back-button"
              onClick={() => {
                setSection("series");
                setShowDescription(false);
              }}
            >
              ← Voltar ao catálogo
            </button>

            <div className="dv-detail-hero">
              <img
                src={selectedSeries.image || DEFAULT_COVER}
                alt={selectedSeries.title}
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = DEFAULT_COVER;
                }}
              />

              <div className="dv-detail-content">
                <span className="dv-eyebrow">
                  {selectedSeries.category}
                </span>

                <h1>{selectedSeries.title}</h1>

                {selectedSeries.description && (
                  <div className="dv-description">
                    <button
                      className="dv-description-toggle"
                      onClick={() =>
                        setShowDescription((previous) => !previous)
                      }
                      aria-expanded={showDescription}
                    >
                      {showDescription
                        ? "Ocultar descrição ▲"
                        : "Ver descrição ▼"}
                    </button>

                    {showDescription && (
                      <p className="dv-description-text">
                        {selectedSeries.description}
                      </p>
                    )}
                  </div>
                )}

                <button
                  className={`dv-favorite-button ${
                    isFavorite(selectedSeries) ? "active" : ""
                  }`}
                  onClick={() => toggleFavorite(selectedSeries)}
                >
                  {isFavorite(selectedSeries)
                    ? "♥ Remover dos favoritos"
                    : "♡ Adicionar aos favoritos"}
                </button>
              </div>
            </div>

            <div className="dv-section">
              <h2>
                {selectedSeries.isChris
                  ? "Temporada 4 — Episódios"
                  : "Episódios"}
              </h2>

              {selectedSeries.isChris && (
                <div className="dv-season-label">
                  Temporada 4
                  <span>22 episódios</span>
                </div>
              )}

              {episodesLoading && (
                <p className="dv-empty">
                  Carregando episódios...
                </p>
              )}

              {!episodesLoading && episodes.length === 0 && (
                <p className="dv-empty">
                  Ainda não há episódios cadastrados para esta série.
                </p>
              )}

              <div className="dv-episodes">
                {episodes.map((episode, index) => (
                  <article
                    className="dv-episode"
                    key={
                      episode.id ||
                      episode.episode_number ||
                      index
                    }
                  >
                    <div className="dv-episode-number">
                      {String(
                        episode.episode_number || index + 1
                      ).padStart(2, "0")}
                    </div>

                    <div className="dv-episode-info">
                      <h3>
                        {episode.title || `Episódio ${index + 1}`}
                      </h3>

                      <p>
                        {episode.video_url
                          ? "Disponível para reprodução"
                          : "Vídeo ainda não configurado"}
                      </p>
                    </div>

                    <button
                      className="dv-primary-button"
                      onClick={() => openEpisode(episode)}
                    >
                      ▶ Assistir
                    </button>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      {playerOpen && (
        <div
          className="dv-player-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closePlayer();
            }
          }}
        >
          <div className="dv-player-modal">
            <div className="dv-player-header">
              <h2>{currentVideo?.title || "Reprodutor"}</h2>

              <button
                onClick={closePlayer}
                aria-label="Fechar player"
              >
                ✕
              </button>
            </div>

            {playerError ? (
              <div className="dv-player-message">
                <span>▶</span>

                <p>{playerError}</p>

                <button
                  className="dv-primary-button"
                  onClick={closePlayer}
                >
                  Voltar
                </button>
              </div>
            ) : (
              <video
                ref={videoRef}
                className={
                  currentVideo?.type === "episode"
                    ? "dv-video dv-video-vertical"
                    : "dv-video"
                }
                controls
                autoPlay
                playsInline
                onEnded={() => {
                  if (currentVideo?.type === "episode") {
                    playNextEpisode();
                  }
                }}
                onError={() => {
                  setPlayerError(
                    "Não foi possível carregar o vídeo. Confira o endereço e as permissões."
                  );
                }}
              />
            )}

            {currentVideo?.type === "episode" && !playerError && (
              <button
                className="dv-primary-button dv-next-button"
                onClick={playNextEpisode}
              >
                Próximo episódio →
              </button>
            )}
          </div>
        </div>
      )}

      <footer className="dv-footer">
        DRAMOVIX · Sempre tem uma nova história.
      </footer>

      <style>{`
        :root {
          color-scheme: dark;
          font-family: Arial, Helvetica, sans-serif;
          background: #090909;
          color: #f5f5f5;
        }

        * {
          box-sizing: border-box;
        }

        html {
          background: #090909;
        }

        body {
          margin: 0;
          background: #090909;
        }

        button,
        input {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        .dv-app {
          min-height: 100vh;
          background: #090909;
          color: #f5f5f5;
        }

        .dv-header {
          position: sticky;
          top: 0;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 12px 4%;
          background: rgba(9, 9, 9, 0.97);
          border-bottom: 1px solid #242424;
        }

        .dv-logo {
          flex-shrink: 0;
          border: 0;
          background: transparent;
          color: #f20d25;
          font-size: 24px;
          font-weight: 900;
          letter-spacing: -1px;
        }

        .dv-logo span {
          color: white;
        }

        .dv-search {
          min-width: 0;
        }

        .dv-search input {
          width: min(310px, 45vw);
          padding: 10px 13px;
          border: 1px solid #333;
          border-radius: 9px;
          outline: none;
          background: #171717;
          color: white;
        }

        .dv-search input:focus {
          border-color: #ed1027;
        }

        .dv-nav {
          display: flex;
          gap: 8px;
          padding: 10px 4%;
          overflow-x: auto;
          border-bottom: 1px solid #222;
          scrollbar-width: thin;
        }

        .dv-nav button,
        .dv-categories button {
          flex-shrink: 0;
          white-space: nowrap;
          padding: 9px 13px;
          border: 1px solid #303030;
          border-radius: 20px;
          background: #171717;
          color: #ddd;
          transition:
            background 0.2s,
            border-color 0.2s;
        }

        .dv-nav button.selected,
        .dv-categories button.selected {
          background: #ed1027;
          border-color: #ed1027;
          color: white;
        }

        .dv-main {
          width: min(1180px, 100%);
          min-height: 70vh;
          margin: auto;
          padding: 16px 4% 42px;
        }

        .dv-hero {
          display: flex;
          align-items: center;
          min-height: 225px;
          padding: clamp(22px, 4vw, 45px);
          border: 1px solid #292020;
          border-radius: 15px;
          background:
            linear-gradient(
              90deg,
              #171717 0%,
              rgba(20, 20, 20, 0.96) 55%,
              rgba(20, 20, 20, 0.45) 100%
            ),
            radial-gradient(
              circle at 85% 40%,
              #68111b,
              #111 65%
            );
        }

        .dv-hero h1 {
          max-width: 480px;
          margin: 9px 0;
          font-size: clamp(26px, 3.5vw, 42px);
          line-height: 1.15;
        }

        .dv-hero p {
          margin: 10px 0 18px;
          color: #bdbdbd;
          line-height: 1.6;
        }

        .dv-eyebrow,
        .dv-card-category {
          color: #ff4052;
          font-size: 11px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }

        .dv-section {
          margin-top: 26px;
        }

        .dv-section > h1 {
          margin: 0 0 18px;
          font-size: clamp(25px, 3vw, 34px);
        }

        .dv-section > h2 {
          margin: 0 0 15px;
          font-size: 21px;
        }

        .dv-categories {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin: 13px 0 20px;
        }

        .dv-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          align-items: start;
          gap: 14px;
        }

        .dv-card {
          min-width: 0;
          overflow: hidden;
          border: 1px solid #252525;
          border-radius: 10px;
          background: #141414;
          transition:
            border-color 0.2s,
            transform 0.2s;
        }

        .dv-card:hover {
          border-color: #484848;
          transform: translateY(-2px);
        }

        .dv-cover-button {
          position: relative;
          display: block;
          width: 100%;
          padding: 0;
          overflow: hidden;
          border: 0;
          background: #171717;
        }

        .dv-cover {
          display: block;
          width: 100%;
          aspect-ratio: 3 / 4;
          object-fit: cover;
          transition: transform 0.2s;
        }

        .dv-cover-button:hover .dv-cover {
          transform: scale(1.035);
        }

        .dv-play-icon {
          position: absolute;
          right: 9px;
          bottom: 9px;
          display: grid;
          width: 34px;
          height: 34px;
          place-items: center;
          border-radius: 50%;
          background: #ed1027;
          color: white;
          font-size: 13px;
        }

        .dv-live-badge {
          position: absolute;
          top: 8px;
          left: 8px;
          padding: 5px 7px;
          border-radius: 5px;
          background: #ed1027;
          font-size: 10px;
          font-weight: bold;
        }

        .dv-card-info {
          display: flex;
          min-width: 0;
          flex-direction: column;
          align-items: stretch;
          padding: 10px;
        }

        .dv-card-category {
          display: block;
          overflow: hidden;
          font-size: 10px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .dv-card-info h3 {
          display: -webkit-box;
          min-width: 0;
          margin: 7px 0 10px;
          overflow: hidden;
          font-size: 14px;
          font-weight: 700;
          line-height: 1.35;
          overflow-wrap: anywhere;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .dv-primary-button {
          padding: 9px 11px;
          border: 0;
          border-radius: 7px;
          background: #ed1027;
          color: white;
          font-size: 13px;
          font-weight: bold;
          transition: background 0.2s;
        }

        .dv-primary-button:hover {
          background: #c90019;
        }

        .dv-card-info .dv-primary-button {
          width: 100%;
          margin-top: auto;
        }

        .dv-favorite-button {
          align-self: flex-start;
          max-width: 100%;
          margin-top: 7px;
          padding: 6px 0;
          border: 0;
          background: transparent;
          color: #ccc;
          font-size: 12px;
          text-align: left;
        }

        .dv-favorite-button.active {
          color: #ff4052;
        }

        .dv-details {
          padding-top: 8px;
        }

        .dv-back-button {
          margin-bottom: 15px;
          padding: 9px 12px;
          border: 1px solid #333;
          border-radius: 8px;
          background: #171717;
          color: white;
          font-size: 13px;
        }

        .dv-back-button:hover {
          border-color: #ed1027;
        }

        .dv-detail-hero {
          display: grid;
          grid-template-columns: minmax(150px, 220px) minmax(0, 1fr);
          align-items: start;
          gap: 22px;
          padding: 18px;
          border: 1px solid #252525;
          border-radius: 12px;
          background: #131313;
        }

        .dv-detail-hero > img {
          display: block;
          width: 100%;
          max-height: 300px;
          aspect-ratio: 3 / 4;
          border-radius: 9px;
          background: #171717;
          object-fit: cover;
        }

        .dv-detail-content {
          min-width: 0;
        }

        .dv-detail-hero h1 {
          margin: 8px 0 12px;
          font-size: clamp(23px, 3vw, 34px);
          line-height: 1.2;
          overflow-wrap: anywhere;
        }

        .dv-description {
          margin: 12px 0;
        }

        .dv-description-toggle {
          padding: 9px 12px;
          border: 1px solid #383838;
          border-radius: 7px;
          background: #1b1b1b;
          color: #fff;
          font-size: 13px;
          font-weight: bold;
          text-align: left;
        }

        .dv-description-toggle:hover {
          border-color: #ed1027;
          background: #241416;
        }

        .dv-description-text {
          margin: 12px 0;
          color: #bdbdbd;
          font-size: 14px;
          line-height: 1.65;
          overflow-wrap: anywhere;
        }

        .dv-detail-content > .dv-favorite-button {
          display: block;
          margin-top: 12px;
        }

        .dv-season-label {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin: 12px 0;
          padding: 12px 14px;
          border-left: 3px solid #ed1027;
          border-radius: 5px;
          background: #171717;
          font-size: 14px;
          font-weight: bold;
        }

        .dv-season-label span {
          color: #aaa;
          font-weight: normal;
        }

        .dv-episodes {
          display: grid;
          gap: 9px;
        }

        .dv-episode {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          padding: 11px;
          border: 1px solid #292929;
          border-radius: 9px;
          background: #141414;
        }

        .dv-episode-number {
          display: grid;
          flex-shrink: 0;
          width: 38px;
          height: 38px;
          place-items: center;
          border-radius: 8px;
          background: #292929;
          color: #ff4052;
          font-size: 13px;
          font-weight: bold;
        }

        .dv-episode-info {
          flex: 1;
          min-width: 0;
        }

        .dv-episode-info h3 {
          margin: 0 0 5px;
          font-size: 14px;
          overflow-wrap: anywhere;
        }

        .dv-episode-info p {
          margin: 0;
          color: #999;
          font-size: 11px;
          line-height: 1.4;
        }

        .dv-player-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 12px;
          background: rgba(0, 0, 0, 0.9);
        }

        .dv-player-modal {
          width: min(850px, 100%);
          max-height: 95vh;
          overflow: auto;
          border: 1px solid #333;
          border-radius: 12px;
          background: #111;
        }

        .dv-player-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 11px 14px;
        }

        .dv-player-header h2 {
          min-width: 0;
          margin: 0;
          font-size: 15px;
          line-height: 1.4;
          overflow-wrap: anywhere;
        }

        .dv-player-header button {
          flex-shrink: 0;
          padding: 3px 7px;
          border: 0;
          background: transparent;
          color: white;
          font-size: 23px;
        }

        .dv-video {
          display: block;
          width: 100%;
          max-height: 75vh;
          background: black;
        }

        .dv-video-vertical {
          width: auto;
          max-width: 100%;
          height: min(72vh, 760px);
          aspect-ratio: 9 / 16;
          margin: 0 auto;
          object-fit: contain;
        }

        .dv-player-message {
          display: flex;
          min-height: 250px;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
          padding: 22px;
          text-align: center;
        }

        .dv-player-message span {
          color: #ed1027;
          font-size: 42px;
        }

        .dv-player-message p {
          max-width: 480px;
          color: #ccc;
          font-size: 14px;
          line-height: 1.6;
        }

        .dv-next-button {
          display: block;
          margin: 12px auto;
        }

        .dv-empty {
          padding: 20px 0;
          color: #aaa;
          line-height: 1.5;
        }

        .dv-footer {
          margin-top: 25px;
          padding: 22px 4%;
          border-top: 1px solid #222;
          color: #777;
          text-align: center;
          font-size: 12px;
        }

        @media (min-width: 1500px) {
          .dv-main {
            width: min(1280px, 100%);
          }
        }

        @media (max-width: 1050px) {
          .dv-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 12px;
          }

          .dv-main {
            padding-right: 3%;
            padding-left: 3%;
          }
        }

        @media (max-width: 760px) {
          .dv-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 10px;
          }

          .dv-card-info {
            padding: 9px;
          }

          .dv-card-info h3 {
            font-size: 13px;
          }

          .dv-primary-button {
            padding: 9px 8px;
            font-size: 12px;
          }

          .dv-detail-hero {
            grid-template-columns: minmax(120px, 170px) minmax(0, 1fr);
            gap: 15px;
            padding: 14px;
          }

          .dv-detail-hero h1 {
            font-size: 23px;
          }
        }

        @media (max-width: 520px) {
          .dv-header {
            align-items: stretch;
            flex-direction: column;
            gap: 10px;
            padding: 12px 4%;
          }

          .dv-logo {
            align-self: flex-start;
            font-size: 23px;
          }

          .dv-search input {
            width: 100%;
          }

          .dv-nav {
            gap: 7px;
            padding: 9px 4%;
          }

          .dv-nav button {
            padding: 8px 11px;
            font-size: 12px;
          }

          .dv-main {
            padding: 13px 4% 30px;
          }

          .dv-hero {
            min-height: 195px;
            padding: 22px 18px;
            border-radius: 11px;
          }

          .dv-hero h1 {
            font-size: 29px;
          }

          .dv-hero p {
            font-size: 13px;
          }

          .dv-section {
            margin-top: 23px;
          }

          .dv-section > h2 {
            font-size: 19px;
          }

          .dv-categories {
            gap: 7px;
            margin: 12px 0 17px;
          }

          .dv-categories button {
            padding: 8px 11px;
            font-size: 12px;
          }

          .dv-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 11px;
          }

          .dv-card {
            border-radius: 9px;
          }

          .dv-card-info {
            padding: 9px;
          }

          .dv-card-category {
            font-size: 9px;
          }

          .dv-card-info h3 {
            margin: 6px 0 9px;
            font-size: 13px;
            line-height: 1.35;
          }

          .dv-card-info .dv-primary-button {
            font-size: 11px;
          }

          .dv-favorite-button {
            font-size: 11px;
          }

          .dv-detail-hero {
            grid-template-columns: minmax(0, 1fr);
            gap: 13px;
            padding: 13px;
          }

          .dv-detail-hero > img {
            width: min(185px, 100%);
            max-height: 250px;
            margin: 0 auto;
          }

          .dv-detail-content {
            width: 100%;
          }

          .dv-detail-hero h1 {
            margin: 7px 0 10px;
            font-size: 25px;
          }

          .dv-description-text {
            font-size: 13px;
          }

          .dv-episode {
            gap: 8px;
            padding: 8px;
          }

          .dv-episode-number {
            width: 32px;
            height: 32px;
            font-size: 11px;
          }

          .dv-episode-info h3 {
            font-size: 12px;
          }

          .dv-episode-info p {
            font-size: 10px;
          }

          .dv-episode .dv-primary-button {
            flex-shrink: 0;
            padding: 9px 7px;
            font-size: 10px;
          }

          .dv-season-label {
            padding: 11px;
            font-size: 12px;
          }

          .dv-video-vertical {
            height: min(70vh, 650px);
          }

          .dv-player-overlay {
            padding: 7px;
          }

          .dv-player-modal {
            max-height: 96vh;
            border-radius: 9px;
          }

          .dv-player-header {
            padding: 10px;
          }

          .dv-player-header h2 {
            font-size: 13px;
          }

          .dv-footer {
            padding: 20px 4%;
          }
        }
      `}</style>
    </div>
  );
}
