import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "./supabase";
import Hls from "hls.js";
import "./App.css";

const DEFAULT_SERIES_COVER =
  "https://placehold.co/600x800/171717/ffffff?text=DRAMOVIX";

const DEFAULT_MOVIE_COVER =
  "https://placehold.co/600x800/171717/ffffff?text=FILME";

const LIVE_SERIES = {
  id: "dramovix-live-z-nation",
  title: "Z Nation",
  category: "Ao vivo",
  description:
    "🔴 AO VIVO AGORA! Entre nessa história de ação, terror e sobrevivência em um mundo dominado por zumbis. Acompanhe a transmissão aqui no DRAMOVIX.",
  image:
    "https://svinrjrlrlitipleiccb.supabase.co/storage/v1/object/public/dramovix-videos/Capas/Znation.PNG",
  video_url: "https://epg.provider.plex.tv/library/parts/646546f35db8ada4c8edd7e5-67d1be3696c7b08c26c19d64.m3u8?includeAllStreams=1&x-plex-product=Plex+Mediaverse&x-plex-token=MZFkHw1Atc9c9bZLRyWw&auto=0",
  type: "live",
  isLive: true,
};

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getSeriesCover(item = {}) {
  const title = normalizeText(item.title || item.name || "");

  if (title.includes("z nation")) {
    return item.image || item.cover_url || LIVE_SERIES.image;
  }

  if (title.includes("sireno") || title.includes("cortejar")) {
    return "/Ensinei%20um%20Sireno%20a%20Cortejar%E2%80%A6%20e%20Agora%20Sou%20Sua.jpg";
  }

  if (
    title.includes("baba do herdeiro") ||
    title.includes("herdeiro virou marido")
  ) {
    return "/baba-do-herdeiro.png";
  }

  return (
    item.cover_url ||
    item.image ||
    item.poster_url ||
    item.poster ||
    DEFAULT_SERIES_COVER
  );
}

function getErrorDetails(error) {
  if (!error) return "Erro desconhecido.";

  return [
    error.message,
    error.details,
    error.hint,
    error.code ? `Código: ${error.code}` : "",
  ]
    .filter(Boolean)
    .join(" — ");
}

function isHlsUrl(url = "") {
  return /\.m3u8(?:$|[?#])/i.test(url);
}

function isUfoLoadUrl(url = "") {
  return /^https?:\/\/(?:www\.)?ufoload\.com\/(?:e|v)\/[a-zA-Z0-9_-]+(?:[/?#].*)?$/i.test(
    String(url).trim()
  );
}

function getUfoLoadEmbedUrl(url = "") {
  const match = String(url)
    .trim()
    .match(
      /^https?:\/\/(?:www\.)?ufoload\.com\/(?:e|v)\/([a-zA-Z0-9_-]+)/i
    );

  return match ? `https://ufoload.com/e/${match[1]}` : "";
}

function isInternetArchiveUrl(url = "") {
  return /^https?:\/\/(?:www\.)?archive\.org\/(?:details|embed)\/[a-zA-Z0-9._-]+(?:[/?#].*)?$/i.test(
    String(url).trim()
  );
}

function getInternetArchiveEmbedUrl(url = "") {
  const match = String(url)
    .trim()
    .match(
      /^https?:\/\/(?:www\.)?archive\.org\/(?:details|embed)\/([a-zA-Z0-9._-]+)/i
    );

  return match ? `https://archive.org/embed/${match[1]}` : "";
}

function isAnonMP4Url(url = "") {
  return /^https?:\/\/(?:www\.)?anonmp4\.(?:art|to)\/(?:v|embed)\/[a-zA-Z0-9_-]+(?:[/?#].*)?$/i.test(
    String(url).trim()
  );
}

function getAnonMP4EmbedUrl(url = "") {
  const match = String(url)
    .trim()
    .match(
      /^https?:\/\/(?:www\.)?(anonmp4\.(?:art|to))\/(?:v|embed)\/([a-zA-Z0-9_-]+)/i
    );

  if (!match) return "";

  return `https://${match[1]}/embed/${match[2]}`;
}

function isEmbeddedVideoUrl(url = "") {
  return (
    isUfoLoadUrl(url) ||
    isInternetArchiveUrl(url) ||
    isAnonMP4Url(url)
  );
}

function getEmbeddedVideoUrl(url = "") {
  if (isUfoLoadUrl(url)) return getUfoLoadEmbedUrl(url);
  if (isInternetArchiveUrl(url)) {
    return getInternetArchiveEmbedUrl(url);
  }
  if (isAnonMP4Url(url)) return getAnonMP4EmbedUrl(url);

  return "";
}

function normalizeEpisodeTitle(episode, index) {
  return (
    episode.title ||
    episode.name ||
    `Episódio ${episode.episode_number ?? index + 1}`
  );
}

export default function App() {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const mediaRecoveryRef = useRef(false);

  const [section, setSection] = useState("Início");
  const [series, setSeries] = useState([]);
  const [movies, setMovies] = useState([]);

  const [selectedSeries, setSelectedSeries] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [currentVideo, setCurrentVideo] = useState(null);

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
  const [error, setError] = useState("");
  const [playerOpen, setPlayerOpen] = useState(false);
  const [playerError, setPlayerError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      setLoading(true);
      setError("");

      const [seriesResult, moviesResult] = await Promise.all([
        supabase
          .from("series")
          .select("*")
          .order("created_at", { ascending: false }),

        supabase.from("movies").select("*"),
      ]);

      if (cancelled) return;

      if (seriesResult.error) {
        console.error(
          "Erro ao carregar minisséries:",
          getErrorDetails(seriesResult.error)
        );

        setError(
          "Não foi possível carregar as minisséries. Confira a tabela series e suas permissões no Supabase."
        );

        setLoading(false);
        return;
      }

      const loadedSeries = (seriesResult.data || []).map((item) => ({
        ...item,
        id: item.id,
        title: item.title || item.name || "Minissérie sem título",
        category: item.genre || item.category || "Romance",
        description: item.description || "",
        image: getSeriesCover(item),
        type: "series",
      }));

      setSeries(loadedSeries);

      if (moviesResult.error) {
        console.warn(
          "Erro ao carregar filmes:",
          getErrorDetails(moviesResult.error)
        );

        setMovies([]);
      } else {
        setMovies(
          (moviesResult.data || []).map((item) => ({
            ...item,
            id: item.id,
            title: item.title || item.name || "Filme sem título",
            image:
              item.cover_url ||
              item.poster_url ||
              item.image ||
              DEFAULT_MOVIE_COVER,
            video_url:
              item.video_url || item.stream_url || item.url || "",
            type: "movie",
          }))
        );
      }

      setLoading(false);
    }

    loadCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "dramovix-favorites",
        JSON.stringify(favorites)
      );
    } catch (err) {
      console.warn("Erro ao salvar favoritos:", err);
    }
  }, [favorites]);

  useEffect(() => {
    if (!selectedSeries || selectedSeries.type === "live") {
      setEpisodes([]);
      return;
    }

    let cancelled = false;

    async function loadEpisodes() {
      setEpisodesLoading(true);
      setEpisodes([]);

      const { data, error: episodeError } = await supabase
        .from("episodes")
        .select("*")
        .eq("series_id", selectedSeries.id)
        .order("episode_number", { ascending: true });

      if (cancelled) return;

      if (episodeError) {
        console.error(
          "Erro ao carregar episódios:",
          getErrorDetails(episodeError)
        );

        setEpisodes([]);
      } else {
        setEpisodes(data || []);
      }

      setEpisodesLoading(false);
    }

    loadEpisodes();

    return () => {
      cancelled = true;
    };
  }, [selectedSeries]);

  function openPlayer(item, type = "movie") {
    const videoUrl = String(
      item.video_url ||
        item.stream_url ||
        item.url ||
        item.video ||
        ""
    ).trim();

    setPlayerError("");
    mediaRecoveryRef.current = false;

    setCurrentVideo({
      ...item,
      url: videoUrl,
      type,
      name: item.name || item.title || "DRAMOVIX",
    });

    setPlayerOpen(true);

    if (!videoUrl) {
      setPlayerError(
        type === "live"
          ? "A transmissão ao vivo ainda não foi configurada. Cadastre um link de transmissão válido para assistir."
          : "Este conteúdo ainda não possui um endereço de vídeo cadastrado."
      );
    }
  }

  function openEpisode(episode, index) {
    setSelectedEpisode(episode);

    openPlayer(
      {
        ...episode,
        title: normalizeEpisodeTitle(episode, index),
        name: normalizeEpisodeTitle(episode, index),
        video_url:
          episode.video_url ||
          episode.stream_url ||
          episode.url ||
          "",
      },
      "episode"
    );
  }

  function watchSireno() {
    if (episodesLoading) return;

    setError("");

    if (!episodes.length) {
      setError(
        "Ainda não há episódios cadastrados para esta minissérie."
      );
      return;
    }

    const firstIndex = episodes.findIndex((episode) =>
      String(
        episode.video_url ||
          episode.stream_url ||
          episode.url ||
          ""
      ).trim()
    );

    if (firstIndex === -1) {
      setError("Nenhum episódio possui um link de vídeo cadastrado.");
      return;
    }

    openEpisode(episodes[firstIndex], firstIndex);
  }

  function playNextEpisode() {
    if (!selectedEpisode || !episodes.length) {
      setPlayerError("Não há outro episódio disponível.");
      return;
    }

    const currentIndex = episodes.findIndex(
      (episode) =>
        String(episode.id) === String(selectedEpisode.id)
    );

    const nextEpisode = episodes[currentIndex + 1];

    if (!nextEpisode) {
      setPlayerError(
        "Você chegou ao último episódio desta minissérie."
      );
      return;
    }

    setSelectedEpisode(nextEpisode);
    setPlayerError("");
    mediaRecoveryRef.current = false;

    const nextUrl = String(
      nextEpisode.video_url ||
        nextEpisode.stream_url ||
        nextEpisode.url ||
        ""
    ).trim();

    setCurrentVideo({
      ...nextEpisode,
      url: nextUrl,
      type: "episode",
      name: normalizeEpisodeTitle(nextEpisode, currentIndex + 1),
    });

    if (!nextUrl) {
      setPlayerError(
        "Este episódio ainda não possui um endereço de vídeo cadastrado."
      );
    }
  }

  function closePlayer() {
    setPlayerOpen(false);
    setCurrentVideo(null);
    setSelectedEpisode(null);
    setPlayerError("");
    mediaRecoveryRef.current = false;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }
  }

  useEffect(() => {
    if (
      !playerOpen ||
      !currentVideo?.url ||
      !videoRef.current ||
      isEmbeddedVideoUrl(currentVideo.url)
    ) {
      return undefined;
    }

    const video = videoRef.current;
    const url = currentVideo.url;
    let cancelled = false;
    let hls = null;

    setPlayerError("");
    mediaRecoveryRef.current = false;

    function tryPlay() {
      const result = video.play();

      if (result && typeof result.catch === "function") {
        result.catch((err) => {
          if (cancelled) return;

          if (err.name === "NotAllowedError") {
            setPlayerError(
              "Toque no botão de reprodução do vídeo para começar."
            );
          }
        });
      }
    }

    if (isHlsUrl(url)) {
      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 30,
          maxBufferLength: 30,
        });

        hlsRef.current = hls;
        hls.attachMedia(video);

        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          if (!cancelled) hls.loadSource(url);
        });

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!cancelled) {
            setPlayerError("");
            tryPlay();
          }
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (cancelled || !data.fatal) return;

          console.error("Erro fatal HLS:", data);

          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            if (!mediaRecoveryRef.current) {
              mediaRecoveryRef.current = true;

              try {
                hls.recoverMediaError();
              } catch {
                setPlayerError(
                  "Não foi possível recuperar a reprodução do vídeo."
                );
              }
            } else {
              setPlayerError(
                "Não foi possível recuperar a reprodução deste vídeo."
              );

              hls.destroy();
            }

            return;
          }

          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            setPlayerError(
              "Não foi possível carregar o vídeo. Confira o link e a disponibilidade do servidor."
            );

            hls.destroy();

            if (hlsRef.current === hls) {
              hlsRef.current = null;
            }

            return;
          }

          setPlayerError(
            "Este vídeo não pôde ser reproduzido. Verifique o link."
          );

          hls.destroy();

          if (hlsRef.current === hls) {
            hlsRef.current = null;
          }
        });
      } else if (
        video.canPlayType("application/vnd.apple.mpegurl")
      ) {
        video.src = url;
        video.load();
        tryPlay();
      } else {
        setPlayerError(
          "Este navegador não oferece suporte à reprodução HLS."
        );
      }
    } else {
      video.src = url;
      video.load();
      tryPlay();
    }

    return () => {
      cancelled = true;

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
  }, [playerOpen, currentVideo]);

  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  function toggleFavorite(item, type = "series") {
    const key = `${type}-${item.id}`;

    setFavorites((previous) => {
      if (previous.some((favorite) => favorite.key === key)) {
        return previous.filter((favorite) => favorite.key !== key);
      }

      return [
        ...previous,
        {
          key,
          id: item.id,
          type,
          title: item.title || item.name || "Sem título",
          image: item.image || DEFAULT_SERIES_COVER,
          item,
        },
      ];
    });
  }

  function isFavorite(item, type = "series") {
    return favorites.some(
      (favorite) => favorite.key === `${type}-${item.id}`
    );
  }

  function goHome() {
    setSection("Início");
    setSelectedSeries(null);
    setSearch("");
    setCategory("Todas");
    setError("");
  }

  const allSeries = useMemo(
    () => [...series, LIVE_SERIES],
    [series]
  );

  const seriesCategories = useMemo(
    () => [
      "Todas",
      ...new Set(
        series.map((item) => item.category).filter(Boolean)
      ),
    ],
    [series]
  );

  const filteredSeries = useMemo(() => {
    const query = normalizeText(search);

    return allSeries.filter((item) => {
      const matchesCategory =
        category === "Todas" || item.category === category;

      const matchesSearch =
        !query ||
        normalizeText(item.title).includes(query) ||
        normalizeText(item.description).includes(query) ||
        normalizeText(item.category).includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [allSeries, category, search]);

  const filteredMovies = useMemo(() => {
    const query = normalizeText(search);

    return movies.filter(
      (item) =>
        !query ||
        normalizeText(item.title).includes(query) ||
        normalizeText(item.description || "").includes(query)
    );
  }, [movies, search]);

  const favoriteSeries = favorites.filter(
    (favorite) => favorite.type === "series"
  );

  const favoriteMovies = favorites.filter(
    (favorite) => favorite.type === "movie"
  );

  function openSeriesDetails(item) {
    setSelectedSeries(item);
    setSection("Minisséries");
    setError("");
  }

  function renderSeriesCard(item) {
    const live = item.isLive === true;

    return (
      <article className="dv-card" key={item.id}>
        <button
          className="dv-card-image-button"
          onClick={() =>
            live ? openPlayer(item, "live") : openSeriesDetails(item)
          }
          aria-label={live ? "Abrir Z Nation ao vivo" : `Abrir ${item.title}`}
        >
          <img
            className="dv-card-image"
            src={item.image || DEFAULT_SERIES_COVER}
            alt={item.title}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = DEFAULT_SERIES_COVER;
            }}
          />

          {live && (
            <span className="dv-live-badge">
              <span className="dv-live-dot" />
              AO VIVO AGORA
            </span>
          )}

          <span className="dv-card-play">▶</span>
        </button>

        <div className="dv-card-info">
          <span className="dv-card-category">
            {live ? "TRANSMISSÃO AO VIVO" : item.category}
          </span>

          <h3>{item.title}</h3>

          <p>
            {item.description ||
              "Uma nova história espera por você."}
          </p>

          <div className="dv-card-actions">
            <button
              className="dv-primary-button"
              onClick={() =>
                live ? openPlayer(item, "live") : openSeriesDetails(item)
              }
            >
              {live ? "▶ Assistir agora" : "Ver episódios"}
            </button>

            <button
              className={`dv-favorite-button ${
                isFavorite(item, live ? "live" : "series")
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                toggleFavorite(item, live ? "live" : "series")
              }
              aria-label="Adicionar ou remover dos favoritos"
              title="Favoritos"
            >
              {isFavorite(item, live ? "live" : "series") ? "♥" : "♡"}
            </button>
          </div>
        </div>
      </article>
    );
  }

  function renderMovieCard(item) {
    return (
      <article className="dv-card" key={item.id}>
        <button
          className="dv-card-image-button"
          onClick={() => openPlayer(item, "movie")}
          aria-label={`Assistir ${item.title}`}
        >
          <img
            className="dv-card-image"
            src={item.image || DEFAULT_MOVIE_COVER}
            alt={item.title}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = DEFAULT_MOVIE_COVER;
            }}
          />

          <span className="dv-card-play">▶</span>
        </button>

        <div className="dv-card-info">
          <h3>{item.title}</h3>
          <p>{item.description || "Assista no DRAMOVIX."}</p>

          <div className="dv-card-actions">
            <button
              className="dv-primary-button"
              onClick={() => openPlayer(item, "movie")}
            >
              ▶ Assistir
            </button>

            <button
              className={`dv-favorite-button ${
                isFavorite(item, "movie") ? "active" : ""
              }`}
              onClick={() => toggleFavorite(item, "movie")}
              aria-label="Adicionar ou remover dos favoritos"
              title="Favoritos"
            >
              {isFavorite(item, "movie") ? "♥" : "♡"}
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className="dv-app">
      <style>{`
        :root {
          color-scheme: dark;
          font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background: #080808;
          color: #f5f5f5;
        }

        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { margin: 0; background: #080808; }
        button, input { font: inherit; }
        button { cursor: pointer; }

        .dv-app {
          min-height: 100vh;
          background: #080808;
          color: #f5f5f5;
        }

        .dv-header {
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(8,8,8,.96);
          backdrop-filter: blur(18px);
          border-bottom: 1px solid #262626;
        }

        .dv-header-inner {
          width: min(1400px,100%);
          margin: auto;
          padding: 17px 28px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 22px;
          flex-wrap: wrap;
        }

        .dv-brand {
          font-size: 28px;
          font-weight: 1000;
          letter-spacing: 2px;
          color: white;
          border: 0;
          background: none;
          padding: 0;
        }

        .dv-brand span { color: #e50914; }

        .dv-nav {
          display: flex;
          gap: 7px;
          flex-wrap: wrap;
          align-items: center;
        }

        .dv-nav button {
          color: #bdbdbd;
          border: 1px solid transparent;
          background: transparent;
          border-radius: 7px;
          padding: 10px 13px;
          font-size: 13px;
          transition: .2s;
        }

        .dv-nav button:hover,
        .dv-nav button.active {
          color: white;
          background: #202020;
          border-color: #333;
        }

        .dv-main {
          width: min(1400px,100%);
          padding: 26px 28px 65px;
          margin: auto;
        }

        .dv-search {
          width: 100%;
          max-width: 460px;
          display: block;
          margin: 0 0 26px;
          padding: 13px 16px;
          border-radius: 7px;
          border: 1px solid #333;
          color: white;
          background: #171717;
          outline: none;
        }

        .dv-search:focus { border-color: #e50914; }

        .dv-hero {
          position: relative;
          overflow: hidden;
          min-height: 340px;
          padding: 52px;
          border-radius: 14px;
          margin-bottom: 34px;
          border: 1px solid #333;
          background:
            linear-gradient(90deg, rgba(0,0,0,.96), rgba(0,0,0,.75) 55%, rgba(0,0,0,.12)),
            radial-gradient(ellipse at 80% 40%, #6b1218, #191919 65%);
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
        }

        .dv-hero-label {
          color: #ff454d;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 3px;
          text-transform: uppercase;
        }

        .dv-hero h1 {
          font-size: clamp(36px,5vw,62px);
          line-height: 1.03;
          margin: 15px 0;
          max-width: 700px;
          font-weight: 900;
        }

        .dv-hero p {
          max-width: 600px;
          color: #d0d0d0;
          line-height: 1.8;
          font-size: 15px;
        }

        .dv-hero-live {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          color: #ff444b;
          font-weight: 900;
          font-size: 12px;
          letter-spacing: 1px;
        }

        .dv-live-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #f20d19;
          box-shadow: 0 0 10px rgba(242,13,25,.8);
          animation: dv-pulse 1.4s infinite;
        }

        @keyframes dv-pulse {
          0%,100% { opacity: 1; }
          50% { opacity: .4; }
        }

        .dv-development-notice {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 20px;
          margin: 0 0 32px;
          border: 1px solid #303030;
          border-left: 4px solid #e50914;
          border-radius: 8px;
          background: #141414;
        }

        .dv-development-icon { font-size: 28px; }

        .dv-development-notice h2 {
          margin: 0 0 9px;
          color: white;
          font-size: 17px;
        }

        .dv-development-notice p {
          margin: 0 0 10px;
          color: #bcbcbc;
          font-size: 13px;
          line-height: 1.7;
        }

        .dv-development-notice strong {
          display: block;
          color: #ff555c;
          font-size: 13px;
        }

        .dv-development-notice .dv-development-thanks {
          margin: 10px 0 0;
          color: #888;
          font-size: 12px;
        }

        .dv-section-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          flex-wrap: wrap;
          margin: 32px 0 18px;
        }

        .dv-section-heading h2 {
          margin: 0;
          font-size: 23px;
          font-weight: 800;
        }

        .dv-muted {
          color: #969696;
          font-size: 12px;
        }

        .dv-categories {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin: 15px 0 24px;
        }

        .dv-categories button {
          padding: 9px 14px;
          border-radius: 6px;
          color: #ccc;
          border: 1px solid #333;
          background: #171717;
          font-size: 13px;
        }

        .dv-categories button.active {
          background: #e50914;
          border-color: #e50914;
          color: white;
        }

        .dv-grid {
          display: grid;
          grid-template-columns: repeat(5,minmax(0,1fr));
          gap: 18px;
        }

        .dv-card {
          min-width: 0;
          overflow: hidden;
          border-radius: 9px;
          border: 1px solid #292929;
          background: #141414;
          transition: transform .2s,border-color .2s;
        }

        .dv-card:hover {
          transform: translateY(-4px);
          border-color: #e50914;
        }

        .dv-card-image-button {
          display: block;
          position: relative;
          width: 100%;
          aspect-ratio: 3/4;
          padding: 0;
          border: 0;
          background: #171717;
          overflow: hidden;
        }

        .dv-card-image {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform .3s;
        }

        .dv-card:hover .dv-card-image { transform: scale(1.04); }

        .dv-card-play {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%,-50%);
          display: grid;
          place-items: center;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: #e50914;
          color: white;
          opacity: 0;
          transition: opacity .2s;
        }

        .dv-card-image-button:hover .dv-card-play { opacity: 1; }

        .dv-live-badge {
          position: absolute;
          top: 10px;
          left: 9px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 7px 9px;
          border-radius: 4px;
          background: #e50914;
          color: white;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .5px;
          box-shadow: 0 4px 15px rgba(0,0,0,.4);
        }

        .dv-live-badge .dv-live-dot {
          width: 6px;
          height: 6px;
          background: white;
          box-shadow: none;
        }

        .dv-card-info { padding: 13px; }

        .dv-card-info h3 {
          font-size: 14px;
          line-height: 1.4;
          margin: 6px 0 8px;
          overflow-wrap: anywhere;
        }

        .dv-card-info p {
          font-size: 12px;
          line-height: 1.6;
          color: #a9a9a9;
          margin: 0 0 13px;
        }

        .dv-card-category {
          color: #ff4b53;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .dv-card-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .dv-primary-button {
          border: 0;
          border-radius: 5px;
          padding: 10px 13px;
          background: #e50914;
          color: white;
          font-size: 12px;
          font-weight: 800;
          transition: background .2s;
        }

        .dv-primary-button:hover { background: #ff1722; }

        .dv-primary-button:disabled {
          opacity: .45;
          cursor: not-allowed;
        }

        .dv-favorite-button {
          flex-shrink: 0;
          border: 1px solid #393939;
          border-radius: 5px;
          width: 38px;
          height: 38px;
          color: #ccc;
          background: #1d1d1d;
          font-size: 22px;
        }

        .dv-favorite-button.active {
          color: #ff4b53;
          border-color: #e50914;
        }

        .dv-back-button {
          margin-bottom: 20px;
          padding: 10px 13px;
          color: white;
          border: 1px solid #383838;
          background: #171717;
          border-radius: 5px;
        }

        .dv-detail {
          display: grid;
          grid-template-columns: minmax(180px,280px) minmax(0,1fr);
          gap: 30px;
          align-items: start;
        }

        .dv-detail-cover {
          width: 100%;
          max-height: 420px;
          object-fit: cover;
          border-radius: 9px;
          border: 1px solid #333;
        }

        .dv-detail-content { min-width: 0; }

        .dv-detail-content h1 {
          font-size: clamp(27px,4vw,40px);
          overflow-wrap: anywhere;
          margin: 9px 0 12px;
        }

        .dv-detail-content p {
          color: #c1c1c1;
          line-height: 1.8;
        }

        .dv-episode-list {
          display: grid;
          gap: 10px;
          margin-top: 20px;
        }

        .dv-episode {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
          padding: 14px;
          border: 1px solid #2c2c2c;
          border-radius: 7px;
          background: #151515;
        }

        .dv-episode-number {
          flex: 0 0 40px;
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          border-radius: 6px;
          background: #292929;
          color: white;
          font-weight: 800;
        }

        .dv-episode-info { flex: 1; min-width: 0; }

        .dv-episode-info h3 {
          font-size: 14px;
          line-height: 1.4;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .dv-episode-info p {
          font-size: 12px;
          color: #999;
          margin: 5px 0 0;
        }

        .dv-episode .dv-primary-button { flex-shrink: 0; }

        .dv-notice {
          padding: 15px;
          border-radius: 7px;
          color: #ffb8bc;
          background: #241012;
          border: 1px solid #702027;
          line-height: 1.6;
          margin: 15px 0;
        }

        .dv-empty {
          padding: 35px 20px;
          text-align: center;
          color: #aaa;
          border: 1px dashed #383838;
          border-radius: 8px;
          background: #121212;
          line-height: 1.7;
        }

        .dv-footer {
          padding: 26px 20px;
          text-align: center;
          color: #777;
          border-top: 1px solid #262626;
          font-size: 12px;
        }

        .dv-player-modal {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: rgba(0,0,0,.97);
          backdrop-filter: blur(12px);
        }

        .dv-player-panel {
          position: relative;
          display: flex;
          flex-direction: column;
          width: min(100%,950px);
          max-height: 94dvh;
          overflow: auto;
          border: 1px solid #383838;
          border-radius: 10px;
          background: #101010;
          padding: 12px;
        }

        .dv-player-modal.dv-player-vertical .dv-player-panel {
          width: min(100%,420px);
          max-height: 96dvh;
        }

        .dv-player-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 4px 2px 12px;
        }

        .dv-player-header h2 {
          font-size: 15px;
          line-height: 1.4;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .dv-player-close {
          flex-shrink: 0;
          border: 1px solid #444;
          background: #222;
          color: white;
          border-radius: 5px;
          width: 38px;
          height: 38px;
          font-size: 21px;
        }

        .dv-video-wrap {
          position: relative;
          width: 100%;
          aspect-ratio: 16/9;
          background: #000;
          border-radius: 6px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .dv-player-vertical .dv-video-wrap {
          aspect-ratio: 9/16;
          width: 100%;
          max-height: calc(96dvh - 100px);
          margin: 0 auto;
          flex: 0 0 auto;
          border-radius: 6px;
          background: #000;
        }

        .dv-video {
          width: 100%;
          height: 100%;
          display: block;
          background: #000;
          object-fit: contain;
          border: 0;
        }

        .dv-video-wrap iframe.dv-video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          min-width: 0;
          min-height: 0;
          border: 0;
          background: #000;
        }

        .dv-player-error {
          color: #ffb7bc;
          background: #291114;
          border: 1px solid #5d2028;
          border-radius: 6px;
          padding: 12px;
          margin-top: 12px;
          font-size: 13px;
          line-height: 1.6;
          overflow-wrap: anywhere;
        }

        .dv-player-next {
          display: flex;
          justify-content: flex-end;
          margin-top: 12px;
        }

        @media (max-width: 1000px) {
          .dv-grid { grid-template-columns: repeat(4,minmax(0,1fr)); }
        }

        @media (max-width: 760px) {
          .dv-header-inner {
            padding: 12px 14px;
            gap: 12px;
          }

          .dv-brand { font-size: 23px; }

          .dv-nav {
            width: 100%;
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
          }

          .dv-nav button {
            padding: 8px 9px;
            font-size: 12px;
          }

          .dv-main { padding: 18px 14px 40px; }

          .dv-hero {
            min-height: 300px;
            padding: 28px 21px;
            border-radius: 9px;
          }

          .dv-grid {
            grid-template-columns: repeat(2,minmax(0,1fr));
            gap: 12px;
          }

          .dv-card-info { padding: 10px; }
          .dv-card-info h3 { font-size: 13px; }
          .dv-card-info p { font-size: 11px; }

          .dv-detail {
            grid-template-columns: 1fr;
            gap: 20px;
          }

          .dv-detail-cover {
            width: min(65%,240px);
            margin: 0 auto;
            display: block;
          }

          .dv-episode {
            gap: 9px;
            padding: 10px;
          }

          .dv-episode-number {
            flex-basis: 34px;
            width: 34px;
            height: 34px;
          }

          .dv-episode-info h3 { font-size: 12px; }

          .dv-episode .dv-primary-button {
            padding: 9px;
            font-size: 11px;
          }

          .dv-player-modal { padding: 8px; }
          .dv-player-panel { padding: 9px; }

          .dv-player-modal.dv-player-vertical .dv-player-panel {
            width: min(100%,420px);
            max-height: 98dvh;
          }

          .dv-player-vertical .dv-video-wrap {
            width: 100%;
            aspect-ratio: 9/16;
            max-height: calc(98dvh - 95px);
          }

          .dv-development-notice {
            gap: 11px;
            padding: 15px;
          }

          .dv-development-icon { font-size: 24px; }
          .dv-development-notice h2 { font-size: 15px; }
        }

        @media (max-width: 380px) {
          .dv-nav button {
            padding: 7px;
            font-size: 11px;
          }

          .dv-card-actions { gap: 5px; }

          .dv-primary-button {
            padding: 9px;
            font-size: 11px;
          }

          .dv-favorite-button {
            width: 34px;
            height: 34px;
          }
        }
      `}</style>

      <header className="dv-header">
        <div className="dv-header-inner">
          <button className="dv-brand" onClick={goHome}>
            DRAMO<span>VIX</span>
          </button>

          <nav className="dv-nav">
            {[
              "Início",
              "Minisséries",
              "Filmes",
              "Ao vivo",
              "Favoritos",
            ].map((item) => (
              <button
                key={item}
                className={section === item ? "active" : ""}
                onClick={() => {
                  setSection(item);
                  setSelectedSeries(null);
                  setError("");
                }}
              >
                {item === "Favoritos"
                  ? `♥ Favoritos (${favorites.length})`
                  : item}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="dv-main">
        <input
          className="dv-search"
          type="search"
          placeholder="Buscar minisséries ou filmes..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        {error && <div className="dv-notice">{error}</div>}

        {loading && (
          <div className="dv-empty">Carregando catálogo...</div>
        )}

        {!loading && section === "Início" && (
          <>
            <section className="dv-hero">
              <span className="dv-hero-label">
                DRAMOVIX ORIGINAL
              </span>

              <h1>Sempre tem uma nova história.</h1>

              <p>
                Romance, vingança, suspense e histórias que prendem
                você do primeiro ao último episódio.
              </p>

              <button
                className="dv-primary-button"
                onClick={() => {
                  setSection("Minisséries");
                  setSelectedSeries(null);
                }}
              >
                Explorar catálogo
              </button>
            </section>

            <div className="dv-development-notice">
              <div className="dv-development-icon">🎬</div>

              <div>
                <h2>DRAMOVIX está em desenvolvimento</h2>

                <p>
                  Estamos preparando tudo para você viver grandes histórias.
                  Nosso catálogo está em construção e novas produções
                  serão adicionadas ao longo do tempo.
                </p>

                <strong>
                  ✨ Novas histórias e episódios chegarão em breve!
                </strong>

                <p className="dv-development-thanks">
                  Obrigado por fazer parte dessa jornada. ❤️
                </p>
              </div>
            </div>

            <div className="dv-section-heading">
              <h2>🔴 Em destaque agora</h2>
              <span className="dv-muted">Transmissão ao vivo</span>
            </div>

            <div className="dv-grid">
              {renderSeriesCard(LIVE_SERIES)}
            </div>

            <div className="dv-section-heading">
              <h2>Minisséries em destaque</h2>
              <span className="dv-muted">
                {filteredSeries.filter((item) => !item.isLive).length}{" "}
                histórias
              </span>
            </div>

            {filteredSeries.filter((item) => !item.isLive).length ? (
              <div className="dv-grid">
                {filteredSeries
                  .filter((item) => !item.isLive)
                  .slice(0, 10)
                  .map(renderSeriesCard)}
              </div>
            ) : (
              <div className="dv-empty">
                Nenhuma minissérie encontrada.
              </div>
            )}

            {filteredMovies.length > 0 && (
              <>
                <div className="dv-section-heading">
                  <h2>Filmes</h2>
                </div>

                <div className="dv-grid">
                  {filteredMovies.slice(0, 5).map(renderMovieCard)}
                </div>
              </>
            )}
          </>
        )}

        {!loading && section === "Minisséries" && (
          <>
            {selectedSeries ? (
              <>
                <button
                  className="dv-back-button"
                  onClick={() => setSelectedSeries(null)}
                >
                  ← Voltar ao catálogo
                </button>

                {selectedSeries.type === "live" ? (
                  <section className="dv-detail">
                    <img
                      className="dv-detail-cover"
                      src={selectedSeries.image}
                      alt={selectedSeries.title}
                    />

                    <div className="dv-detail-content">
                      <span className="dv-hero-live">
                        <span className="dv-live-dot" />
                        AO VIVO AGORA
                      </span>

                      <h1>{selectedSeries.title}</h1>

                      <p>{selectedSeries.description}</p>

                      <button
                        className="dv-primary-button"
                        style={{
                          marginTop: 16,
                          padding: "14px 22px",
                          fontSize: 14,
                        }}
                        onClick={() =>
                          openPlayer(selectedSeries, "live")
                        }
                      >
                        ▶ ASSISTIR AGORA
                      </button>

                      <p style={{ fontSize: 12, color: "#999" }}>
                        A reprodução depende da disponibilidade de um
                        link de transmissão válido.
                      </p>
                    </div>
                  </section>
                ) : (
                  <section className="dv-detail">
                    <img
                      className="dv-detail-cover"
                      src={getSeriesCover(selectedSeries)}
                      alt={selectedSeries.title}
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = DEFAULT_SERIES_COVER;
                      }}
                    />

                    <div className="dv-detail-content">
                      <span className="dv-card-category">
                        {selectedSeries.category}
                      </span>

                      <h1>{selectedSeries.title}</h1>

                      <p>
                        {selectedSeries.description ||
                          "Prepare-se para acompanhar esta história."}
                      </p>

                      <button
                        className={`dv-favorite-button ${
                          isFavorite(selectedSeries, "series")
                            ? "active"
                            : ""
                        }`}
                        onClick={() =>
                          toggleFavorite(selectedSeries, "series")
                        }
                        title="Favoritos"
                      >
                        {isFavorite(selectedSeries, "series") ? "♥" : "♡"}
                      </button>

                      {normalizeText(selectedSeries.title).includes(
                        "sireno"
                      ) ||
                      normalizeText(selectedSeries.title).includes(
                        "cortejar"
                      ) ? (
                        <div style={{ marginTop: 24 }}>
                          <button
                            className="dv-primary-button"
                            onClick={watchSireno}
                            disabled={episodesLoading}
                            style={{
                              width: "100%",
                              maxWidth: 340,
                              padding: "15px 18px",
                              fontSize: 14,
                            }}
                          >
                            {episodesLoading
                              ? "CARREGANDO EPISÓDIO..."
                              : "▶ ASSISTIR MINISSÉRIE"}
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="dv-section-heading">
                            <h2>Episódios</h2>
                            <span className="dv-muted">
                              {episodes.length} episódios
                            </span>
                          </div>

                          {episodesLoading ? (
                            <div className="dv-empty">
                              Carregando episódios...
                            </div>
                          ) : episodes.length ? (
                            <div className="dv-episode-list">
                              {episodes.map((episode, index) => (
                                <article
                                  className="dv-episode"
                                  key={episode.id}
                                >
                                  <div className="dv-episode-number">
                                    {episode.episode_number ?? index + 1}
                                  </div>

                                  <div className="dv-episode-info">
                                    <h3>
                                      {normalizeEpisodeTitle(
                                        episode,
                                        index
                                      )}
                                    </h3>

                                    <p>
                                      Episódio{" "}
                                      {episode.episode_number ?? index + 1}
                                    </p>
                                  </div>

                                  <button
                                    className="dv-primary-button"
                                    onClick={() =>
                                      openEpisode(episode, index)
                                    }
                                  >
                                    ▶ Assistir
                                  </button>
                                </article>
                              ))}
                            </div>
                          ) : (
                            <div className="dv-empty">
                              Ainda não há episódios cadastrados para esta
                              minissérie.
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </section>
                )}
              </>
            ) : (
              <>
                <div className="dv-section-heading">
                  <h2>Minisséries</h2>
                  <span className="dv-muted">
                    {filteredSeries.length} títulos
                  </span>
                </div>

                <div className="dv-categories">
                  {seriesCategories.map((item) => (
                    <button
                      key={item}
                      className={category === item ? "active" : ""}
                      onClick={() => setCategory(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                {filteredSeries.length ? (
                  <div className="dv-grid">
                    {filteredSeries.map(renderSeriesCard)}
                  </div>
                ) : (
                  <div className="dv-empty">
                    Nenhuma minissérie encontrada.
                  </div>
                )}
              </>
            )}
          </>
        )}

        {!loading && section === "Filmes" && (
          <>
            <div className="dv-section-heading">
              <h2>Filmes</h2>
              <span className="dv-muted">
                {filteredMovies.length} filmes
              </span>
            </div>

            {filteredMovies.length ? (
              <div className="dv-grid">
                {filteredMovies.map(renderMovieCard)}
              </div>
            ) : (
              <div className="dv-empty">
                Nenhum filme encontrado. Verifique se a tabela movies
                existe no Supabase e se há filmes cadastrados.
              </div>
            )}
          </>
        )}

        {!loading && section === "Ao vivo" && (
          <>
            <section className="dv-hero">
              <span className="dv-hero-live">
                <span className="dv-live-dot" />
                DRAMOVIX · AO VIVO
              </span>

              <h1>Está passando agora.</h1>

              <p>
                Acompanhe as transmissões ao vivo disponíveis no
                DRAMOVIX.
              </p>
            </section>

            <div className="dv-section-heading">
              <h2>Séries ao vivo</h2>
              <span className="dv-muted">1 transmissão</span>
            </div>

            <div className="dv-grid">
              {renderSeriesCard(LIVE_SERIES)}
            </div>

            <div className="dv-section-heading">
              <h2>Como funciona</h2>
            </div>

            <div className="dv-empty">
              Escolha Z Nation e toque em “Assistir agora”. Para que o
              vídeo seja reproduzido, é necessário configurar o endereço
              válido da transmissão.
            </div>
          </>
        )}

        {!loading && section === "Favoritos" && (
          <>
            <div className="dv-section-heading">
              <h2>Meus favoritos</h2>
              <span className="dv-muted">
                {favorites.length} salvos
              </span>
            </div>

            {favoriteSeries.length > 0 && (
              <>
                <div className="dv-section-heading">
                  <h2>Minisséries</h2>
                </div>

                <div className="dv-grid">
                  {favoriteSeries.map((favorite) => {
                    const item =
                      series.find(
                        (entry) =>
                          String(entry.id) === String(favorite.id)
                      ) || favorite.item;

                    return renderSeriesCard(item);
                  })}
                </div>
              </>
            )}

            {favoriteMovies.length > 0 && (
              <>
                <div className="dv-section-heading">
                  <h2>Filmes</h2>
                </div>

                <div className="dv-grid">
                  {favoriteMovies.map((favorite) => {
                    const item =
                      movies.find(
                        (entry) =>
                          String(entry.id) === String(favorite.id)
                      ) || favorite.item;

                    return renderMovieCard(item);
                  })}
                </div>
              </>
            )}

            {favorites.length === 0 && (
              <div className="dv-empty">
                Você ainda não adicionou favoritos. Toque no coração
                de uma minissérie ou filme para salvá-lo.
              </div>
            )}
          </>
        )}
      </main>

      <footer className="dv-footer">
        DRAMOVIX · Sempre tem uma nova história.
      </footer>

      {playerOpen && (
        <div
          className={`dv-player-modal ${
            currentVideo?.type === "episode"
              ? "dv-player-vertical"
              : ""
          }`}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closePlayer();
            }
          }}
        >
          <div className="dv-player-panel">
            <div className="dv-player-header">
              <h2>
                {currentVideo?.name ||
                  currentVideo?.title ||
                  "DRAMOVIX"}
              </h2>

              <button
                className="dv-player-close"
                onClick={closePlayer}
                aria-label="Fechar vídeo"
              >
                ×
              </button>
            </div>

            {currentVideo?.url ? (
              <div className="dv-video-wrap">
                {isEmbeddedVideoUrl(currentVideo.url) ? (
                  <iframe
                    key={getEmbeddedVideoUrl(currentVideo.url)}
                    src={getEmbeddedVideoUrl(currentVideo.url)}
                    title={
                      currentVideo?.name ||
                      currentVideo?.title ||
                      "Vídeo DRAMOVIX"
                    }
                    className="dv-video"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    loading="eager"
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                ) : (
                  <video
                    key={currentVideo.url}
                    ref={videoRef}
                    className="dv-video"
                    controls
                    playsInline
                    autoPlay
                    preload="metadata"
                    onEnded={() => {
                      if (currentVideo?.type === "episode") {
                        playNextEpisode();
                      }
                    }}
                    onError={() => {
                      if (!isHlsUrl(currentVideo?.url || "")) {
                        setPlayerError(
                          "Não foi possível reproduzir este vídeo. Verifique se o link está correto e acessível."
                        );
                      }
                    }}
                  />
                )}
              </div>
            ) : (
              <div className="dv-empty">
                {currentVideo?.type === "live"
                  ? "🔴 A Z Nation está marcada como AO VIVO AGORA, mas a transmissão ainda não possui um link configurado."
                  : "Este conteúdo ainda não possui um link de vídeo cadastrado."}
              </div>
            )}

            {playerError && (
              <div className="dv-player-error">{playerError}</div>
            )}

            {currentVideo?.type === "episode" && (
              <div className="dv-player-next">
                <button
                  className="dv-primary-button"
                  onClick={playNextEpisode}
                  disabled={
                    !selectedEpisode ||
                    episodes.findIndex(
                      (episode) =>
                        String(episode.id) ===
                        String(selectedEpisode.id)
                    ) >=
                      episodes.length - 1
                  }
                >
                  Próximo episódio →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
