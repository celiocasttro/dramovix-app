import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import Hls from "hls.js";
import "./App.css";

const ZNATION_URL =
  "https://epg.provider.plex.tv/library/parts/646546f35db8ada4c8edd7e5-67d1be3696c7b08c26c19d64.m3u8?includeAllStreams=1&x-plex-product=Plex+Mediaverse&x-plex-token=MZFkHw1Atc9c9bZLRyWw&auto=0";

const DEFAULT_COVER =
  "https://svinrjrlrlitipleiccb.supabase.co/storage/v1/object/public/dramovix-videos/Capas/Znation.PNG";

const DEFAULT_MOVIE_COVER = DEFAULT_COVER;

const LIVE_SERIES = {
  id: "live-znation",
  title: "Z Nation",
  category: "Ao vivo",
  description: "Assista à transmissão de Z Nation.",
  image: DEFAULT_COVER,
  video_url: ZNATION_URL,
  isLive: true,
};

const normalize = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export default function App() {
  const [series, setSeries] = useState([]);
  const [movies, setMovies] = useState([]);
  const [liveChannels, setLiveChannels] = useState([]);
  const [liveChannelsLoading, setLiveChannelsLoading] = useState(true);

  const [selectedSeries, setSelectedSeries] = useState(null);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [selectedEpisode, setSelectedEpisode] = useState(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");
  const [page, setPage] = useState("filmes");

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
  const [showDescription, setShowDescription] = useState(false);
  const [episodeDrawerOpen, setEpisodeDrawerOpen] = useState(false);

  const videoRef = useRef(null);
  const hlsRef = useRef(null);

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
      setLiveChannelsLoading(true);

      try {
        const [
          seriesResult,
          moviesResult,
          liveChannelsResult,
        ] = await Promise.all([
          supabase
            .from("series")
            .select("*")
            .eq("published", true)
            .order("created_at", { ascending: false }),

          supabase
            .from("movies")
            .select("*")
            .order("created_at", { ascending: false }),

          supabase
            .from("movie_live_channels")
            .select("*")
            .eq("is_active", true)
            .order("id", { ascending: true }),
        ]);

        if (seriesResult.error) {
          console.error(
            "Erro ao carregar séries:",
            seriesResult.error
          );
        }

        if (moviesResult.error) {
          console.error(
            "Erro ao carregar filmes:",
            moviesResult.error
          );
        }

        if (liveChannelsResult.error) {
          console.error(
            "Erro ao carregar canais:",
            liveChannelsResult.error
          );
        }

        const loadedSeries = (seriesResult.data || [])
          .filter(
            (item) =>
              normalize(item.title) !==
              normalize("Todo Mundo Odeia o Chris")
          )
          .map((item) => ({
            id: `db-${item.id}`,
            dbId: item.id,
            title: item.title || "Sem título",
            category: item.genre || "Romance",
            description: item.description || "",
            image: item.cover_url || DEFAULT_COVER,
            isLive: false,
          }));

        const loadedMovies = (moviesResult.data || []).map(
          (item) => ({
            id: `movie-${item.id}`,
            dbId: item.id,
            title: item.title || "Sem título",
            category: item.genre || "Filme",
            description: item.description || "",
            image: item.cover_url || DEFAULT_MOVIE_COVER,
            video_url: item.video_url || "",
            isMovie: true,
          })
        );

        const loadedLiveChannels = (
          liveChannelsResult.data || []
        ).map((item) => ({
          id: `live-channel-${item.id}`,
          dbId: item.id,
          title: item.name || "Canal ao vivo",
          category: item.category || "Ao vivo",
          description: `Assista ao canal ${
            item.name || "ao vivo"
          }.`,
          image: item.cover_url || DEFAULT_COVER,
          video_url: item.stream_url || "",
          isLive: true,
        }));

        if (!cancelled) {
          setSeries(loadedSeries);
          setMovies(loadedMovies);
          setLiveChannels(
            liveChannelsResult.error ? [] : loadedLiveChannels
          );
        }
      } catch (error) {
        console.error("Erro ao carregar catálogo:", error);

        if (!cancelled) {
          setSeries([]);
          setMovies([]);
          setLiveChannels([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLiveChannelsLoading(false);
        }
      }
    }

    loadCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedSeries || selectedSeries.isLive) {
      setEpisodes([]);
      setEpisodesLoading(false);
      return;
    }

    let cancelled = false;

    async function loadEpisodes() {
      setEpisodesLoading(true);

      try {
        if (!selectedSeries.dbId) {
          if (!cancelled) setEpisodes([]);
          return;
        }

        const { data, error } = await supabase
          .from("episodes")
          .select("*")
          .eq("series_id", selectedSeries.dbId)
          .order("episode_number", { ascending: true });

        if (error) throw error;

        if (!cancelled) {
          setEpisodes(
            (data || []).map((episode) => ({
              ...episode,
              title:
                episode.title ||
                `Episódio ${
                  episode.episode_number || ""
                }`.trim(),
              video_url: episode.video_url || "",
            }))
          );
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

  useEffect(() => {
    if (!playerOpen || !selectedEpisode || !videoRef.current) {
      return;
    }

    const video = videoRef.current;
    const url = selectedEpisode.video_url || "";

    let hls = null;
    let cancelled = false;

    setPlayerError("");

    if (!url) {
      setPlayerError(
        "Este conteúdo ainda não possui um link de vídeo."
      );
      return;
    }

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    video.pause();
    video.removeAttribute("src");
    video.load();

    const isHls = /\.m3u8(?:$|\?)/i.test(url);

    const handleVideoError = () => {
      if (cancelled) return;

      setPlayerError(
        "Não foi possível reproduzir este vídeo. O link pode ter expirado ou o servidor pode bloquear a reprodução."
      );
    };

    video.addEventListener("error", handleVideoError);

    if (isHls && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });

      hlsRef.current = hls;

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        if (!cancelled) hls.loadSource(url);
      });

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!cancelled) {
          video.play().catch(() => {});
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (cancelled || !data.fatal) return;

        setPlayerError(
          "Não foi possível carregar a transmissão."
        );
      });

      hls.attachMedia(video);
    } else if (
      isHls &&
      video.canPlayType("application/vnd.apple.mpegurl")
    ) {
      video.src = url;
      video.load();
      video.play().catch(() => {});
    } else {
      video.src = url;
      video.load();
      video.play().catch(() => {});
    }

    return () => {
      cancelled = true;

      video.removeEventListener("error", handleVideoError);

      if (hls) {
        hls.destroy();

        if (hlsRef.current === hls) {
          hlsRef.current = null;
        }
      }

      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [playerOpen, selectedEpisode]);

  const categories = [
    "Todas",
    ...new Set(
      series
        .filter((item) => !item.isLive)
        .map((item) => item.category)
        .filter(Boolean)
    ),
  ];

  const filteredSeries = series.filter((item) => {
    const matchesSearch =
      normalize(item.title).includes(normalize(search)) ||
      normalize(item.description).includes(normalize(search));

    const matchesCategory =
      category === "Todas" || item.category === category;

    return matchesSearch && matchesCategory;
  });

  const filteredMovies = movies.filter(
    (item) =>
      normalize(item.title).includes(normalize(search)) ||
      normalize(item.description).includes(normalize(search))
  );

  const filteredLiveChannels = liveChannels.filter((item) =>
    normalize(item.title).includes(normalize(search))
  );

  function toggleFavorite(item) {
    if (!item) return;

    setFavorites((previous) =>
      previous.includes(item.id)
        ? previous.filter((id) => id !== item.id)
        : [...previous, item.id]
    );
  }

  function isFavorite(item) {
    return Boolean(item && favorites.includes(item.id));
  }

  function openSeries(item) {
    setSelectedSeries(item);
    setSelectedMovie(null);
    setSelectedEpisode(null);
    setShowDescription(false);
    setPage("detalhes");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function openMovieDetails(item) {
    setSelectedMovie(item);
    setSelectedSeries(null);
    setSelectedEpisode(null);
    setShowDescription(false);
    setPage("detalhes-filme");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function openPlayer(episode) {
    setSelectedEpisode(episode);
    setPlayerError("");
    setPlayerOpen(true);
    setEpisodeDrawerOpen(false);
  }

  function openEpisode(episode) {
    openPlayer(episode);
  }

  function playMovie(movie) {
    if (!movie) return;

    openPlayer({
      id: movie.id,
      title: movie.title,
      video_url: movie.video_url,
      isMovie: true,
    });
  }

  function openLive(item) {
    setSelectedSeries(item);
    setSelectedMovie(null);

    setSelectedEpisode({
      id: `${item.id}-stream`,
      title: item.title,
      video_url: item.video_url,
      isLive: true,
    });

    setPlayerError("");
    setPlayerOpen(true);
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
    setSelectedEpisode(null);
    setPlayerError("");
    setEpisodeDrawerOpen(false);
  }

  function playNextEpisode() {
    if (!selectedEpisode || !episodes.length) return;

    const currentIndex = episodes.findIndex(
      (episode) => episode.id === selectedEpisode.id
    );

    if (
      currentIndex >= 0 &&
      currentIndex < episodes.length - 1
    ) {
      openPlayer(episodes[currentIndex + 1]);
    }
  }

  function handleVideoEnded() {
    if (selectedEpisode?.isLive) return;
    playNextEpisode();
  }

  function goToPage(nextPage) {
    setPage(nextPage);
    setSelectedSeries(null);
    setSelectedMovie(null);
    setSelectedEpisode(null);
    setEpisodes([]);
    setSearch("");
    setCategory("Todas");
    setShowDescription(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function renderCard(item, type = "series") {
    const openItem = () => {
      if (type === "live") {
        openLive(item);
      } else if (type === "movie") {
        openMovieDetails(item);
      } else {
        openSeries(item);
      }
    };

    return (
      <article className="dv-card" key={item.id}>
        <button
          className="dv-card-image-button"
          onClick={openItem}
          aria-label={`Abrir ${item.title}`}
          style={{
            display: "block",
            width: "100%",
            padding: 0,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <img
            className="dv-card-image"
            src={item.image || DEFAULT_COVER}
            alt={item.title}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = DEFAULT_COVER;
            }}
          />

          {type === "live" && (
            <span className="dv-live-badge">AO VIVO</span>
          )}

          <h3
            style={{
              margin: "8px 0 12px",
              fontSize: "14px",
              lineHeight: 1.4,
              fontWeight: 600,
              color: "#ffffff",
            }}
          >
            {item.title}
          </h3>
        </button>
      </article>
    );
  }

  function renderGrid(items, type = "series") {
    if (loading && type !== "live") {
      return (
        <p className="dv-message">
          Carregando catálogo...
        </p>
      );
    }

    if (!items.length) {
      return (
        <div className="dv-empty">
          <span>✦</span>
          <h3>Nenhum conteúdo encontrado</h3>
          <p>
            Tente buscar por outro termo ou categoria.
          </p>
        </div>
      );
    }

    return (
      <div className="dv-grid">
        {items.map((item) => renderCard(item, type))}
      </div>
    );
  }

  const favoriteSeries = series.filter((item) =>
    isFavorite(item)
  );

  const favoriteMovies = movies.filter((item) =>
    isFavorite(item)
  );

  const isLandscapePlayer =
    Boolean(selectedEpisode?.isMovie) ||
    Boolean(selectedEpisode?.isLive) ||
    Boolean(selectedSeries?.isLive);

  const detailItem = selectedSeries || selectedMovie;

  return (
    <div className="dv-app">
      <header className="dv-header">
        <button
          className="dv-logo"
          onClick={() => goToPage("filmes")}
          aria-label="DRAMOVIX início"
        >
          DRAMOVIX<span>+</span>
        </button>

        <div className="dv-header-actions">
          <label className="dv-search">
            <span>⌕</span>

            <input
              type="search"
              placeholder="Pesquisar..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);

                if (page === "filmes") {
                  setPage("explorar");
                }
              }}
            />
          </label>
        </div>
      </header>

      <nav
        className="dv-nav"
        aria-label="Navegação principal"
      >
        {[
          ["filmes", "⌂", "INÍCIO"],
          ["filmes", "🎬", "FILMES"],
          ["series", "▣", "SÉRIES"],
          ["animes", "✦", "ANIME"],
          ["doramas", "◇", "DORAMAS"],
        ].map(([key, icon, label]) => (
          <button
            key={key}
            className={page === key ? "active" : ""}
            onClick={() => goToPage(key)}
          >
            <span style={{ fontSize: "16px" }}>
              {icon}
            </span>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <main className="dv-main">
        {page === "detalhes" && selectedSeries && (
          <section className="dv-detail">
            <button
              className="dv-back"
              onClick={() => goToPage("series")}
            >
              ← Voltar ao catálogo
            </button>

            <div className="dv-detail-header">
              <img
                className="dv-detail-cover"
                src={selectedSeries.image || DEFAULT_COVER}
                alt={selectedSeries.title}
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = DEFAULT_COVER;
                }}
              />

              <div className="dv-detail-info">
                <span
                  className="dv-eyebrow"
                  style={{ color: "#fca5a5" }}
                >
                  {selectedSeries.category || "DRAMA"}
                </span>

                <h1>{selectedSeries.title}</h1>

                <p>
                  {showDescription
                    ? selectedSeries.description ||
                      "Descrição indisponível."
                    : (
                        selectedSeries.description ||
                        "Uma história incrível."
                      ).slice(0, 160) +
                      (
                        (selectedSeries.description || "")
                          .length > 160
                          ? "..."
                          : ""
                      )}
                </p>

                {(selectedSeries.description || "").length >
                  160 && (
                  <button
                    className="dv-description-toggle"
                    onClick={() =>
                      setShowDescription((value) => !value)
                    }
                  >
                    {showDescription
                      ? "Mostrar menos"
                      : "Ler descrição completa"}
                  </button>
                )}

                <div className="dv-detail-actions">
                  <button
                    className="dv-button-primary"
                    onClick={() => {
                      if (episodes.length) {
                        openEpisode(episodes[0]);
                      }
                    }}
                    disabled={
                      episodesLoading || !episodes.length
                    }
                  >
                    ▶ Assistir 1º Episódio
                  </button>

                  <button
                    className="dv-description-toggle"
                    onClick={() =>
                      toggleFavorite(selectedSeries)
                    }
                  >
                    {isFavorite(selectedSeries)
                      ? "♥ Favoritado"
                      : "♡ Favoritar"}
                  </button>
                </div>
              </div>
            </div>

            <section className="dv-episodes">
              <div className="dv-section-heading">
                <div>
                  <h2>Episódios</h2>
                  <p>
                    {episodes.length} episódio(s)
                    disponível(is)
                  </p>
                </div>
              </div>

              {episodesLoading ? (
                <p className="dv-message">
                  Carregando episódios...
                </p>
              ) : episodes.length ? (
                <div className="dv-episode-list">
                  {episodes.map((episode, index) => (
                    <button
                      className="dv-episode"
                      key={episode.id || index}
                      onClick={() => openEpisode(episode)}
                    >
                      <span className="dv-episode-number">
                        {episode.episode_number || index + 1}
                      </span>

                      <span className="dv-episode-info">
                        <strong>
                          {episode.title ||
                            `Episódio ${index + 1}`}
                        </strong>

                        <small style={{ color: "#fca5a5" }}>
                          {episode.video_url
                            ? "Pronto para reprodução"
                            : "Em breve"}
                        </small>
                      </span>

                      <span className="dv-episode-play">
                        ▶
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="dv-empty">
                  <h3>Novos episódios em breve</h3>
                  <p>
                    Estamos preparando os capítulos desta
                    série para você.
                  </p>
                </div>
              )}
            </section>
          </section>
        )}

        {page === "detalhes-filme" && selectedMovie && (
          <section className="dv-detail">
            <button
              className="dv-back"
              onClick={() => goToPage("filmes")}
            >
              ← Voltar ao catálogo
            </button>

            <div className="dv-detail-header">
              <img
                className="dv-detail-cover"
                src={selectedMovie.image || DEFAULT_MOVIE_COVER}
                alt={selectedMovie.title}
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = DEFAULT_MOVIE_COVER;
                }}
              />

              <div className="dv-detail-info">
                <span
                  className="dv-eyebrow"
                  style={{ color: "#fca5a5" }}
                >
                  {selectedMovie.category || "FILME"}
                </span>

                <h1>{selectedMovie.title}</h1>

                <p>
                  {showDescription
                    ? selectedMovie.description ||
                      "Descrição indisponível."
                    : (
                        selectedMovie.description ||
                        "Prepare-se para descobrir esta história."
                      ).slice(0, 160) +
                      (
                        (selectedMovie.description || "")
                          .length > 160
                          ? "..."
                          : ""
                      )}
                </p>

                {(selectedMovie.description || "").length >
                  160 && (
                  <button
                    className="dv-description-toggle"
                    onClick={() =>
                      setShowDescription((value) => !value)
                    }
                  >
                    {showDescription
                      ? "Mostrar menos"
                      : "Ler descrição completa"}
                  </button>
                )}

                <div className="dv-detail-actions">
                  <button
                    className="dv-button-primary"
                    onClick={() => playMovie(selectedMovie)}
                  >
                    ▶ Assistir Filme
                  </button>

                  <button
                    className="dv-description-toggle"
                    onClick={() =>
                      toggleFavorite(selectedMovie)
                    }
                  >
                    {isFavorite(selectedMovie)
                      ? "♥ Favoritado"
                      : "♡ Favoritar"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {page === "filmes" && (
          <>
            <section
              className="dv-hero"
              style={{
                "--hero-image": `url("${(series[0]?.image || movies[0]?.image || DEFAULT_COVER).replace(/"/g, '\\"')}")`,
              }}
            >
              <div className="dv-hero-content">
                <span className="dv-eyebrow">
                  ✦ DRAMOVIX+ CINEMA
                </span>

                <h1>
                  O melhor conteúdo sempre com você.
                </h1>

                <p>
                  Conteúdo variado para todos os gostos.
                  Lançamentos e clássicos atualizados.
                </p>

                <button
                  className="dv-button-primary"
                  onClick={() => {
                    setSearch("");
                    window.scrollTo({
                      top: 0,
                      behavior: "smooth",
                    });
                  }}
                >
                  Explorar Filmes →
                </button>
              </div>
            </section>

            <section className="dv-section dv-home-shelf">
              <div className="dv-section-heading">
                <h2>Continue assistindo</h2>
                <button className="dv-see-all" onClick={() => goToPage("series")}>Ver todos ›</button>
              </div>
              {renderGrid(filteredSeries.slice(0, 4), "series")}
            </section>

            <section className="dv-section dv-home-shelf">
              <div className="dv-section-heading">
                <h2>Desenhos</h2>
                <button className="dv-see-all" onClick={() => goToPage("series")}>Ver todos ›</button>
              </div>
              {renderGrid(filteredSeries.filter((item) => {
                const value = normalize(item.category);
                return value.includes("desenho") || value.includes("kids") || value.includes("infantil") || value.includes("cartoon");
              }).slice(0, 8), "series")}
            </section>

            <section className="dv-section dv-home-shelf">
              <div className="dv-section-heading">
                <h2>Animes</h2>
                <button className="dv-see-all" onClick={() => goToPage("animes")}>Ver todos ›</button>
              </div>
              {renderGrid(filteredSeries.filter((item) => normalize(item.category).includes("anime")).slice(0, 8), "series")}
            </section>

            <section className="dv-section dv-home-shelf">
              <div className="dv-section-heading">
                <h2>Filmes</h2>
                <button className="dv-see-all" onClick={() => goToPage("filmes")}>Ver todos ›</button>
              </div>
              {renderGrid(filteredMovies.slice(0, 8), "movie")}
            </section>

            <section className="dv-section dv-home-shelf">
              <div className="dv-section-heading">
                <h2>Séries</h2>
                <button className="dv-see-all" onClick={() => goToPage("series")}>Ver todos ›</button>
              </div>
              {renderGrid(filteredSeries.slice(0, 8), "series")}
            </section>
          </>
        )}

        {page === "explorar" && (
          <section className="dv-section">
            <div className="dv-section-heading">
              <div>
                <h2>RESULTADOS DA PESQUISA</h2>
                <p>
                  Conteúdos encontrados no catálogo.
                </p>
              </div>
            </div>

            {loading ? (
              <p className="dv-message">
                Carregando catálogo...
              </p>
            ) : (
              <>
                <h3>Filmes</h3>
                {renderGrid(filteredMovies, "movie")}

                <h3 style={{ marginTop: "24px" }}>
                  Séries, animes e doramas
                </h3>
                {renderGrid(filteredSeries, "series")}
              </>
            )}
          </section>
        )}

        {page === "tv" && (
          <section className="dv-section">
            <div className="dv-section-heading">
              <div>
                <h2>TV ONLINE / CANAIS AO VIVO</h2>
                <p>
                  Assista às transmissões de TV e canais
                  disponíveis.
                </p>
              </div>
            </div>

            {liveChannelsLoading ? (
              <p className="dv-message">
                Carregando canais ao vivo...
              </p>
            ) : (
              renderGrid(
                [
                  ...filteredLiveChannels,
                  ...(
                    !search &&
                    !liveChannels.some(
                      (item) =>
                        normalize(item.title) ===
                        normalize("Z Nation")
                    )
                      ? [LIVE_SERIES]
                      : []
                  ),
                ],
                "live"
              )
            )}
          </section>
        )}

        {page === "series" && (
          <section className="dv-section">
            <div className="dv-section-heading">
              <div>
                <h2>SÉRIES</h2>
                <p>
                  Maratone as melhores minisséries e séries.
                </p>
              </div>
            </div>

            {renderGrid(filteredSeries, "series")}
          </section>
        )}

        {page === "animes" && (
          <section className="dv-section">
            <div className="dv-section-heading">
              <div>
                <h2>ANIMES</h2>
                <p>
                  As melhores animações japonesas.
                </p>
              </div>
            </div>

            {renderGrid(
              filteredSeries.filter((item) =>
                normalize(item.category).includes("anime")
              ),
              "series"
            )}
          </section>
        )}

        {page === "favoritos" && (
          <section className="dv-section">
            <div className="dv-section-heading"><h2>Favoritos</h2></div>
            {renderGrid(favoriteSeries, "series")}
            <div className="dv-section-heading"><h2>Filmes favoritos</h2></div>
            {renderGrid(favoriteMovies, "movie")}
          </section>
        )}

        {page === "doramas" && (
          <section className="dv-section">
            <div className="dv-section-heading">
              <div>
                <h2>DORAMAS</h2>
                <p>
                  Séries asiáticas de sucesso.
                </p>
              </div>
            </div>

            {renderGrid(
              filteredSeries.filter((item) =>
                normalize(item.category).includes("dorama")
              ),
              "series"
            )}
          </section>
        )}
      </main>

      <footer className="dv-footer">
        DRAMOVIX+ · Diversão sem limites no seu celular.
      </footer>

      <nav className="dv-bottom-nav" aria-label="Navegação inferior">
        <button className={["filmes", "series", "animes", "doramas", "tv"].includes(page) ? "active" : ""} onClick={() => goToPage("filmes")}>
          <span aria-hidden="true">⌂</span><small>Início</small>
        </button>
        <button className={page === "explorar" ? "active" : ""} onClick={() => { setPage("explorar"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
          <span aria-hidden="true">⌕</span><small>Buscar</small>
        </button>
        <button className={page === "favoritos" ? "active" : ""} onClick={() => goToPage("favoritos")}>
          <span aria-hidden="true">♡</span><small>Favoritos</small>
        </button>
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <span aria-hidden="true">♙</span><small>Perfil</small>
        </button>
      </nav>

      {playerOpen && (
        <div
          className="dv-player-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closePlayer();
            }
          }}
        >
          <div
            className="dv-player-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Player"
          >
            <div className="dv-player-top">
              <div className="dv-player-heading">
                <strong>
                  {selectedEpisode?.title ||
                    selectedSeries?.title ||
                    selectedMovie?.title ||
                    "Reproduzindo"}
                </strong>

                <small style={{ color: "#fca5a5" }}>
                  {selectedEpisode?.isLive
                    ? "Ao vivo"
                    : selectedEpisode?.isMovie
                      ? "Filme"
                      : selectedSeries?.title ||
                        "DRAMOVIX+"}
                </small>
              </div>

              <button
                className="dv-player-close"
                onClick={closePlayer}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <div
              className={`dv-video-wrap ${
                isLandscapePlayer
                  ? "dv-video-wrap--landscape"
                  : "dv-video-wrap--portrait"
              }`}
            >
              <video
                key={selectedEpisode?.id || "video-player"}
                ref={videoRef}
                className="dv-video"
                controls
                playsInline
                preload="metadata"
                onEnded={handleVideoEnded}
              />
            </div>

            {playerError && (
              <div
                className="dv-player-error"
                role="alert"
              >
                {playerError}
              </div>
            )}

            {episodeDrawerOpen && episodes.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  bottom: "70px",
                  left: "10px",
                  right: "10px",
                  background: "rgba(10, 4, 4, 0.95)",
                  border:
                    "1px solid rgba(229, 9, 20, 0.4)",
                  borderRadius: "12px",
                  padding: "12px",
                  maxHeight: "200px",
                  overflowY: "auto",
                  zIndex: 30,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                    fontSize: "12px",
                    fontWeight: "bold",
                    color: "#fca5a5",
                  }}
                >
                  <span>Selecionar Episódio</span>

                  <button
                    onClick={() =>
                      setEpisodeDrawerOpen(false)
                    }
                    style={{
                      cursor: "pointer",
                      border: "none",
                      background: "transparent",
                      color: "#fff",
                    }}
                  >
                    ✕
                  </button>
                </div>

                {episodes.map((episode, index) => (
                  <button
                    key={episode.id || index}
                    onClick={() => openEpisode(episode)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      background:
                        selectedEpisode?.id === episode.id
                          ? "rgba(229, 9, 20, 0.3)"
                          : "transparent",
                      color: "#fff",
                      border: "none",
                      fontSize: "12px",
                      cursor: "pointer",
                      marginBottom: "4px",
                    }}
                  >
                    Episódio{" "}
                    {episode.episode_number || index + 1}:{" "}
                    {episode.title || "Assistir"}
                  </button>
                ))}
              </div>
            )}

            <div className="dv-player-bottom">
              {!selectedEpisode?.isLive &&
              !selectedEpisode?.isMovie &&
              episodes.length > 0 ? (
                <button
                  onClick={() =>
                    setEpisodeDrawerOpen(
                      (previous) => !previous
                    )
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    cursor: "pointer",
                    fontSize: "12px",
                    color: "#fca5a5",
                    background: "rgba(229,9,20,0.15)",
                    padding: "6px 10px",
                    borderRadius: "8px",
                    border:
                      "1px solid rgba(229,9,20,0.3)",
                  }}
                >
                  <span>
                    EP.{selectedEpisode?.episode_number || 1}{" "}
                    / EP.{episodes.length}
                  </span>
                  <span>
                    {episodeDrawerOpen ? "⌄" : "∧"}
                  </span>
                </button>
              ) : (
                <span style={{ color: "#9ca3af" }}>
                  {selectedEpisode?.isLive
                    ? "Transmissão ao vivo"
                    : "Filme · DRAMOVIX+"}
                </span>
              )}

              {!selectedEpisode?.isLive &&
                !selectedEpisode?.isMovie && (
                  <button
                    className="dv-player-next"
                    onClick={playNextEpisode}
                    disabled={
                      !episodes.length ||
                      episodes.findIndex(
                        (episode) =>
                          episode.id === selectedEpisode?.id
                      ) >=
                        episodes.length - 1
                    }
                  >
                    Próximo episódio →
                  </button>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
