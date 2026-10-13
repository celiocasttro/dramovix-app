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
  video_url: "",
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
        const isChris = normalize(item.title) === normalize(CHRIS_TITLE);

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
          if (!cancelled) setEpisodes([]);
          return;
        }

        const { data, error } = await supabase
          .from("episodes")
          .select("*")
          .eq("series_id", dbId)
          .order("episode_number", { ascending: true });

        if (error) throw error;

        if (!cancelled) {
          setEpisodes(data || []);
        }
      } catch (error) {
        console.error("Erro ao carregar episódios:", error);
        if (!cancelled) setEpisodes([]);
      } finally {
        if (!cancelled) setEpisodesLoading(false);
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
    setCurrentVideo({ ...item, video_url: videoUrl, type });
    setPlayerOpen(true);
  }

  function openEpisode(episode) {
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
    if (!currentVideo || !selectedSeries) return;

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

    setPlayerOpen(false);
    setCurrentVideo(null);
    setPlayerError("");
  }

  useEffect(() => {
    if (!playerOpen || !currentVideo || playerError) return;

    const video = videoRef.current;
    const url = currentVideo.video_url;

    if (!video || !url) return;

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
        setPlayerError("Este navegador não suporta este formato de vídeo.");
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
    const matchesSearch = normalize(item.title).includes(normalize(search));

    const matchesCategory =
      category === "Todas" || item.category === category;

    return (
      matchesSearch &&
      matchesCategory &&
      !item.isLive
    );
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

    return (
      <article className="dv-card" key={`${type}-${item.id}`}>
        <button
          className="dv-cover-button"
          onClick={() => {
            if (live) {
              openPlayer(item, "live");
            } else if (type === "movie") {
              openPlayer(item, "movie");
            } else {
              openSeries(item);
            }
          }}
          aria-label={`Abrir ${item.title}`}
        >
          <img
            className="dv-cover"
            src={item.image || DEFAULT_COVER}
            alt={item.title}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.src = DEFAULT_COVER;
            }}
          />

          <span className="dv-play-icon">▶</span>

          {live && <span className="dv-live-badge">AO VIVO</span>}
        </button>

        <div className="dv-card-info">
          <span className="dv-card-category">
            {item.category || (type === "movie" ? "Filme" : "Série")}
          </span>

          <h3>{item.title}</h3>

          <button
            className="dv-primary-button"
            onClick={() => {
              if (live) {
                openPlayer(item, "live");
              } else if (type === "movie") {
                openPlayer(item, "movie");
              } else {
                openSeries(item);
              }
            }}
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
      return <p className="dv-empty">Nenhum título encontrado.</p>;
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
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="dv-main">
        {loading && <p className="dv-empty">Carregando catálogo...</p>}

        {!loading && section === "inicio" && (
          <>
            <section className="dv-hero">
              <div>
                <span className="dv-eyebrow">DRAMOVIX</span>
                <h1>Sempre tem uma nova história.</h1>
                <p>Escolha seu clima e descubra o que assistir.</p>
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
                filteredSeries.filter((item) => !item.isLive).slice(0, 8)
              )}
            </section>

            <section className="dv-section">
              <h2>Filmes</h2>
              {renderGrid(filteredMovies.slice(0, 4), "movie")}
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
              onClick={() => setSection("series")}
            >
              ← Voltar ao catálogo
            </button>

            <div className="dv-detail-hero">
              <img
                src={selectedSeries.image || DEFAULT_COVER}
                alt={selectedSeries.title}
                onError={(event) => {
                  event.currentTarget.src = DEFAULT_COVER;
                }}
              />

              <div>
                <span className="dv-eyebrow">
                  {selectedSeries.category}
                </span>

                <h1>{selectedSeries.title}</h1>

                <p>{selectedSeries.description}</p>

                <button
                  className="dv-favorite-button"
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
                <p className="dv-empty">Carregando episódios...</p>
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
                    key={episode.id || episode.episode_number || index}
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
            if (event.target === event.currentTarget) closePlayer();
          }}
        >
          <div className="dv-player-modal">
            <div className="dv-player-header">
              <h2>{currentVideo?.title || "Reprodutor"}</h2>

              <button onClick={closePlayer} aria-label="Fechar player">
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

        body {
          margin: 0;
          background: #090909;
        }

        button, input {
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
          gap: 20px;
          padding: 16px 5%;
          background: rgba(9,9,9,.96);
          border-bottom: 1px solid #242424;
        }

        .dv-logo {
          border: 0;
          background: transparent;
          color: #f20d25;
          font-size: 25px;
          font-weight: 900;
          letter-spacing: -1px;
        }

        .dv-logo span {
          color: white;
        }

        .dv-search input {
          width: min(330px, 48vw);
          padding: 11px 14px;
          border: 1px solid #333;
          border-radius: 9px;
          outline: none;
          background: #171717;
          color: white;
        }

        .dv-nav {
          display: flex;
          gap: 8px;
          padding: 12px 5%;
          overflow-x: auto;
          border-bottom: 1px solid #222;
        }

        .dv-nav button,
        .dv-categories button {
          white-space: nowrap;
          padding: 10px 15px;
          border: 1px solid #303030;
          border-radius: 20px;
          background: #171717;
          color: #ddd;
        }

        .dv-nav button.selected,
        .dv-categories button.selected {
          background: #ed1027;
          border-color: #ed1027;
          color: white;
        }

        .dv-main {
          width: min(1400px, 100%);
          min-height: 70vh;
          margin: auto;
          padding: 20px 5% 50px;
        }

        .dv-hero {
          display: flex;
          align-items: center;
          min-height: 300px;
          padding: clamp(25px, 6vw, 70px);
          border-radius: 18px;
          background:
            linear-gradient(90deg, #171717 0%, rgba(20,20,20,.94) 50%, rgba(20,20,20,.25) 100%),
            radial-gradient(circle at 85% 40%, #68111b, #111 65%);
        }

        .dv-hero h1 {
          max-width: 600px;
          margin: 10px 0;
          font-size: clamp(30px, 5vw, 52px);
        }

        .dv-hero p,
        .dv-detail-hero p {
          color: #bdbdbd;
          line-height: 1.7;
        }

        .dv-eyebrow,
        .dv-card-category {
          color: #ff4052;
          font-size: 12px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .dv-section {
          margin-top: 34px;
        }

        .dv-section h1,
        .dv-section h2 {
          margin-bottom: 18px;
        }

        .dv-categories {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
          margin: 16px 0 24px;
        }

        .dv-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 18px;
        }

        .dv-card {
          min-width: 0;
          overflow: hidden;
          border: 1px solid #252525;
          border-radius: 12px;
          background: #141414;
        }

        .dv-cover-button {
          position: relative;
          display: block;
          width: 100%;
          padding: 0;
          border: 0;
          background: #171717;
        }

        .dv-cover {
          display: block;
          width: 100%;
          aspect-ratio: 3 / 4;
          object-fit: cover;
          transition: transform .2s;
        }

        .dv-cover-button:hover .dv-cover {
          transform: scale(1.035);
        }

        .dv-play-icon {
          position: absolute;
          right: 12px;
          bottom: 12px;
          display: grid;
          width: 38px;
          height: 38px;
          place-items: center;
          border-radius: 50%;
          background: #ed1027;
          color: white;
        }

        .dv-live-badge {
          position: absolute;
          top: 10px;
          left: 10px;
          padding: 6px 9px;
          border-radius: 5px;
          background: #ed1027;
          font-size: 11px;
          font-weight: bold;
        }

        .dv-card-info {
          padding: 13px;
        }

        .dv-card-info h3 {
          min-height: 40px;
          margin: 8px 0 13px;
          font-size: 15px;
          line-height: 1.4;
        }

        .dv-primary-button {
          padding: 10px 14px;
          border: 0;
          border-radius: 7px;
          background: #ed1027;
          color: white;
          font-weight: bold;
        }

        .dv-primary-button:hover {
          background: #c90019;
        }

        .dv-card-info .dv-primary-button {
          width: 100%;
        }

        .dv-favorite-button {
          margin-top: 9px;
          padding: 8px 0;
          border: 0;
          background: transparent;
          color: #ddd;
        }

        .dv-favorite-button.active {
          color: #ff4052;
        }

        .dv-details {
          padding-top: 15px;
        }

        .dv-back-button {
          margin-bottom: 20px;
          padding: 9px 13px;
          border: 1px solid #333;
          border-radius: 8px;
          background: #171717;
          color: white;
        }

        .dv-detail-hero {
          display: grid;
          grid-template-columns: minmax(180px, 260px) 1fr;
          align-items: center;
          gap: 28px;
          padding: 22px;
          border: 1px solid #252525;
          border-radius: 14px;
          background: #131313;
        }

        .dv-detail-hero img {
          width: 100%;
          max-height: 350px;
          border-radius: 10px;
          object-fit: cover;
        }

        .dv-detail-hero h1 {
          font-size: clamp(25px, 4vw, 40px);
        }

        .dv-season-label {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          margin: 15px 0;
          padding: 13px 15px;
          border-left: 3px solid #ed1027;
          border-radius: 5px;
          background: #171717;
          font-weight: bold;
        }

        .dv-season-label span {
          color: #aaa;
          font-weight: normal;
        }

        .dv-episodes {
          display: grid;
          gap: 10px;
        }

        .dv-episode {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
          padding: 13px;
          border: 1px solid #292929;
          border-radius: 10px;
          background: #141414;
        }

        .dv-episode-number {
          display: grid;
          flex-shrink: 0;
          width: 42px;
          height: 42px;
          place-items: center;
          border-radius: 8px;
          background: #292929;
          color: #ff4052;
          font-weight: bold;
        }

        .dv-episode-info {
          flex: 1;
          min-width: 0;
        }

        .dv-episode-info h3 {
          margin: 0 0 5px;
          font-size: 15px;
        }

        .dv-episode-info p {
          margin: 0;
          color: #999;
          font-size: 12px;
        }

        .dv-player-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 15px;
          background: rgba(0,0,0,.88);
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
          gap: 15px;
          padding: 12px 16px;
        }

        .dv-player-header h2 {
          margin: 0;
          font-size: 16px;
        }

        .dv-player-header button {
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
          min-height: 260px;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 15px;
          padding: 25px;
          text-align: center;
        }

        .dv-player-message span {
          color: #ed1027;
          font-size: 42px;
        }

        .dv-player-message p {
          max-width: 480px;
          color: #ccc;
          line-height: 1.6;
        }

        .dv-next-button {
          display: block;
          margin: 12px auto;
        }

        .dv-empty {
          padding: 25px 0;
          color: #aaa;
        }

        .dv-footer {
          padding: 25px 5%;
          border-top: 1px solid #222;
          color: #777;
          text-align: center;
          font-size: 13px;
        }

        @media (max-width: 1050px) {
          .dv-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 650px) {
          .dv-header {
            align-items: stretch;
            flex-direction: column;
            gap: 12px;
            padding: 14px 4%;
          }

          .dv-logo {
            align-self: flex-start;
          }

          .dv-search input {
            width: 100%;
          }

          .dv-nav {
            padding: 10px 4%;
          }

          .dv-main {
            padding: 15px 4% 35px;
          }

          .dv-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }

          .dv-card-info {
            padding: 10px;
          }

          .dv-card-info h3 {
            font-size: 13px;
          }

          .dv-primary-button {
            padding: 9px 10px;
            font-size: 12px;
          }

          .dv-detail-hero {
            grid-template-columns: 1fr;
          }

          .dv-detail-hero img {
            width: min(220px, 100%);
            margin: auto;
          }

          .dv-episode {
            gap: 9px;
            padding: 9px;
          }

          .dv-episode-number {
            width: 34px;
            height: 34px;
          }

          .dv-episode-info h3 {
            font-size: 13px;
          }

          .dv-episode-info p {
            font-size: 10px;
          }

          .dv-episode .dv-primary-button {
            padding: 9px 8px;
            font-size: 11px;
          }

          .dv-video-vertical {
            height: min(70vh, 650px);
          }
        }
      `}</style>
    </div>
  );
}
