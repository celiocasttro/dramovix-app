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

const NAV_ITEMS = [
  { key: "inicio", label: "Início", icon: "⌂" },
  { key: "ao-vivo", label: "Ao vivo", icon: "◉" },
  { key: "filmes", label: "Filmes", icon: "▣" },
  { key: "favoritos", label: "Favoritos", icon: "♡" },
  { key: "perfil", label: "Perfil", icon: "♙" },
];

export default function App() {
  const [series, setSeries] = useState([]);
  const [movies, setMovies] = useState([]);
  const [liveChannels, setLiveChannels] = useState([]);
  const [liveChannelsLoading, setLiveChannelsLoading] = useState(true);

  const [selectedSeries, setSelectedSeries] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");
  const [page, setPage] = useState("inicio");

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
            "Erro ao carregar canais ao vivo:",
            liveChannelsResult.error
          );
        }

        // Mantém a exclusão já existente no catálogo.
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
          if (!cancelled) {
            setEpisodes([]);
          }
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
        "Este episódio ainda não possui um link de vídeo."
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

      const mediaError = video.error;

      if (mediaError) {
        console.error("Erro do elemento de vídeo:", {
          code: mediaError.code,
          message: mediaError.message,
          url,
        });
      }

      setPlayerError(
        "Não foi possível reproduzir este vídeo. O link pode ter expirado ou o servidor pode bloquear a reprodução."
      );
    };

    const handleMetadata = () => {
      if (cancelled) return;

      console.log("Dimensões do vídeo:", {
        largura: video.videoWidth,
        altura: video.videoHeight,
        orientacao:
          video.videoWidth > video.videoHeight
            ? "horizontal"
            : video.videoWidth < video.videoHeight
              ? "vertical"
              : "quadrado",
      });
    };

    video.addEventListener("error", handleVideoError);
    video.addEventListener("loadedmetadata", handleMetadata);

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
          video.play().catch((error) => {
            console.warn(
              "Reprodução automática bloqueada:",
              error
            );
          });
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (cancelled || !data.fatal) return;

        console.error("Erro fatal do HLS:", data);

        setPlayerError(
          "Não foi possível carregar a transmissão. O link pode ter expirado ou o servidor pode bloquear a reprodução."
        );
      });

      hls.attachMedia(video);
    } else if (
      isHls &&
      video.canPlayType("application/vnd.apple.mpegurl")
    ) {
      video.src = url;
      video.load();

      video.play().catch((error) => {
        console.warn(
          "Reprodução automática bloqueada:",
          error
        );
      });
    } else if (!isHls) {
      video.src = url;
      video.load();

      video.play().catch((error) => {
        console.warn(
          "Reprodução automática bloqueada:",
          error
        );
      });
    } else {
      setPlayerError(
        "Este navegador não conseguiu reproduzir o formato de vídeo."
      );
    }

    return () => {
      cancelled = true;

      video.removeEventListener("error", handleVideoError);
      video.removeEventListener(
        "loadedmetadata",
        handleMetadata
      );

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

  const filteredMovies = movies.filter((item) => {
    const matchesSearch =
      normalize(item.title).includes(normalize(search)) ||
      normalize(item.description).includes(normalize(search));

    return matchesSearch;
  });

  const filteredLiveChannels = liveChannels.filter((item) => {
    const matchesSearch =
      normalize(item.title).includes(normalize(search)) ||
      normalize(item.description).includes(normalize(search));

    return matchesSearch;
  });

  function toggleFavorite(item) {
    setFavorites((previous) =>
      previous.includes(item.id)
        ? previous.filter((id) => id !== item.id)
        : [...previous, item.id]
    );
  }

  function isFavorite(item) {
    return favorites.includes(item.id);
  }

  function openSeries(item) {
    setSelectedSeries(item);
    setSelectedEpisode(null);
    setShowDescription(false);
    setPage("detalhes");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function openPlayer(episode) {
    setSelectedEpisode(episode);
    setPlayerError("");
    setPlayerOpen(true);
  }

  function openEpisode(episode) {
    openPlayer(episode);
  }

  function openLive(item) {
    setSelectedSeries(item);

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
    if (selectedEpisode?.isLive || selectedEpisode?.isMovie) {
      return;
    }

    playNextEpisode();
  }

  function goToPage(nextPage) {
    setPage(nextPage);
    setSelectedSeries(null);
    setSelectedEpisode(null);
    setSearch("");
    setCategory("Todas");
    setShowDescription(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function renderCard(item, type = "series") {
    const favorite = isFavorite(item);

    const openItem = () => {
      if (type === "live") {
        openLive(item);
      } else if (type === "movie") {
        setSelectedSeries(null);

        openPlayer({
          id: item.id,
          title: item.title,
          video_url: item.video_url,
          isMovie: true,
        });
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

          <span className="dv-card-play">▶</span>

          {type === "live" && (
            <span className="dv-live-badge">AO VIVO</span>
          )}
        </button>

        <div className="dv-card-content">
          <span className="dv-card-category">
            {type === "live" ? "AO VIVO" : item.category}
          </span>

          <h3>{item.title}</h3>

          <p>
            {item.description ||
              "Uma nova história espera por você."}
          </p>

          <div className="dv-card-actions">
            <button
              className="dv-button-primary"
              onClick={openItem}
            >
              ▶ {type === "live" ? "Assistir" : type === "movie" ? "Assistir" : "Ver detalhes"}
            </button>

            {type !== "live" && (
              <button
                className={`dv-favorite-button ${
                  favorite ? "active" : ""
                }`}
                onClick={() => toggleFavorite(item)}
                aria-label={
                  favorite
                    ? "Remover dos favoritos"
                    : "Adicionar aos favoritos"
                }
              >
                {favorite ? "♥" : "♡"}
              </button>
            )}
          </div>
        </div>
      </article>
    );
  }

  function renderGrid(items, type = "series") {
    if (loading && type !== "live") {
      return (
        <p className="dv-message">Carregando catálogo...</p>
      );
    }

    if (!items.length) {
      return (
        <div className="dv-empty">
          <span>✦</span>
          <h3>Nada por aqui ainda</h3>
          <p>
            Experimente outra categoria ou faça uma nova busca.
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

  const favoriteCount = favoriteSeries.length + favoriteMovies.length;

  const isLandscapePlayer =
    Boolean(selectedEpisode?.isMovie) ||
    Boolean(selectedEpisode?.isLive) ||
    Boolean(selectedSeries?.isLive);

  return (
    <div className="dv-app">
      <style>{`
        :root {
          color-scheme: dark;
          --dv-bg: #08090e;
          --dv-panel: #11131b;
          --dv-panel-2: #191c27;
          --dv-text: #f7f7fb;
          --dv-muted: #9b9dad;
          --dv-accent: #a855f7;
          --dv-accent-2: #ec4899;
          --dv-border: rgba(255,255,255,.09);
        }

        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }

        body {
          margin: 0;
          background: var(--dv-bg);
          color: var(--dv-text);
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont,
            "Segoe UI", sans-serif;
        }

        button, input { font: inherit; }
        button { cursor: pointer; }

        .dv-app {
          min-height: 100vh;
          padding-bottom: 0;
          background:
            radial-gradient(ellipse at top left, rgba(124,58,237,.11), transparent 38%),
            var(--dv-bg);
          color: var(--dv-text);
        }

        .dv-header {
          position: sticky;
          top: 0;
          z-index: 20;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 15px clamp(16px, 5vw, 76px);
          background: rgba(8,9,14,.94);
          border-bottom: 1px solid var(--dv-border);
          backdrop-filter: blur(18px);
        }

        .dv-logo {
          border: 0;
          background: transparent;
          color: white;
          font-size: 25px;
          font-weight: 950;
          letter-spacing: -1.3px;
          white-space: nowrap;
        }

        .dv-logo span { color: var(--dv-accent); }

        .dv-search {
          display: flex;
          align-items: center;
          width: min(350px, 35vw);
          padding: 0 14px;
          border: 1px solid var(--dv-border);
          border-radius: 999px;
          background: #141620;
        }

        .dv-search span { color: var(--dv-muted); }

        .dv-search input {
          width: 100%;
          padding: 11px;
          border: 0;
          outline: none;
          color: white;
          background: transparent;
        }

        .dv-nav {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 8px;
          padding: 13px 16px;
          border-bottom: 1px solid var(--dv-border);
        }

        .dv-nav button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 9px 15px;
          color: #c5c6d1;
          border: 1px solid transparent;
          border-radius: 999px;
          background: transparent;
          transition: .2s;
        }

        .dv-nav button:hover,
        .dv-nav button.active {
          color: white;
          border-color: rgba(168,85,247,.35);
          background: rgba(168,85,247,.14);
        }

        .dv-nav-icon { font-size: 18px; line-height: 1; }
        .dv-nav-label { font-size: 12px; font-weight: 750; }

        .dv-development-notice {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          width: min(1450px, calc(100% - 32px));
          margin: 20px auto 0;
          padding: 17px 20px;
          border: 1px solid rgba(168,85,247,.38);
          border-radius: 16px;
          background:
            linear-gradient(110deg, rgba(124,58,237,.18), rgba(236,72,153,.09)),
            #11121b;
          box-shadow: 0 8px 30px rgba(0,0,0,.14);
        }

        .dv-development-icon {
          display: grid;
          width: 42px;
          height: 42px;
          flex-shrink: 0;
          place-items: center;
          border-radius: 12px;
          background: rgba(168,85,247,.18);
          color: #d8b4fe;
          font-size: 22px;
        }

        .dv-development-content { min-width: 0; }

        .dv-development-content h2 {
          margin: 1px 0 7px;
          color: #f5d0fe;
          font-size: 15px;
          font-weight: 900;
          letter-spacing: .5px;
        }

        .dv-development-content p {
          margin: 0;
          color: #c7c8d5;
          font-size: 13px;
          line-height: 1.75;
        }

        .dv-development-content strong { color: #fff; }

        .dv-main {
          width: min(1450px, 100%);
          min-height: 70vh;
          margin: auto;
          padding: 26px clamp(16px, 5vw, 76px) 70px;
        }

        .dv-hero {
          position: relative;
          display: flex;
          align-items: center;
          min-height: 290px;
          overflow: hidden;
          margin: 8px 0 34px;
          padding: clamp(25px, 5vw, 58px);
          border: 1px solid rgba(168,85,247,.2);
          border-radius: 26px;
          background:
            radial-gradient(ellipse at 80% 15%, rgba(236,72,153,.35), transparent 35%),
            radial-gradient(ellipse at 65% 100%, rgba(124,58,237,.36), transparent 48%),
            linear-gradient(120deg, #181321, #10121b 72%);
        }

        .dv-hero-content { position: relative; z-index: 1; max-width: 650px; }

        .dv-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #d8b4fe;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .dv-hero h1 {
          margin: 15px 0;
          font-size: clamp(32px, 5vw, 58px);
          line-height: 1.04;
          letter-spacing: -2px;
        }

        .dv-hero p { max-width: 500px; color: #c0c1cf; line-height: 1.7; }

        .dv-button-primary {
          padding: 11px 17px;
          color: white;
          font-weight: 800;
          border: 0;
          border-radius: 10px;
          background: linear-gradient(110deg, #9333ea, #db2777);
          transition: transform .2s, filter .2s;
        }

        .dv-button-primary:hover { transform: translateY(-2px); filter: brightness(1.12); }

        .dv-section { margin: 32px 0 40px; }

        .dv-section-heading {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 19px;
        }

        .dv-section-heading h2 { margin: 0; font-size: clamp(21px, 3vw, 29px); letter-spacing: -.6px; }
        .dv-section-heading p { margin: 7px 0 0; color: var(--dv-muted); font-size: 14px; }

        .dv-categories { display: flex; flex-wrap: wrap; gap: 9px; margin: 17px 0 30px; }

        .dv-category-button {
          padding: 10px 16px;
          color: #d1d2df;
          border: 1px solid var(--dv-border);
          border-radius: 999px;
          background: var(--dv-panel);
        }

        .dv-category-button:hover,
        .dv-category-button.active {
          color: white;
          border-color: var(--dv-accent);
          background: rgba(168,85,247,.17);
        }

        .dv-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 19px;
          width: 100%;
        }

        .dv-card {
          min-width: 0;
          overflow: hidden;
          border: 1px solid var(--dv-border);
          border-radius: 17px;
          background: var(--dv-panel);
          transition: transform .22s, border-color .22s;
        }

        .dv-card:hover { transform: translateY(-4px); border-color: rgba(168,85,247,.45); }

        .dv-card-image-button {
          position: relative;
          display: block;
          width: 100%;
          aspect-ratio: 3 / 4;
          overflow: hidden;
          padding: 0;
          border: 0;
          background: #20212b;
        }

        .dv-card-image { width: 100%; height: 100%; object-fit: cover; transition: transform .3s; }
        .dv-card:hover .dv-card-image { transform: scale(1.04); }

        .dv-card-play {
          position: absolute;
          right: 13px;
          bottom: 13px;
          display: grid;
          width: 43px;
          height: 43px;
          place-items: center;
          border: 1px solid rgba(255,255,255,.25);
          border-radius: 50%;
          background: rgba(168,85,247,.9);
          color: white;
        }

        .dv-live-badge {
          position: absolute;
          top: 12px;
          left: 12px;
          padding: 6px 9px;
          border-radius: 6px;
          color: white;
          background: #dc2626;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .dv-card-content { padding: 15px; }
        .dv-card-category { color: #c084fc; font-size: 10px; font-weight: 850; letter-spacing: 1.2px; text-transform: uppercase; }
        .dv-card h3 { margin: 8px 0; font-size: 16px; line-height: 1.4; overflow-wrap: anywhere; }

        .dv-card p {
          display: -webkit-box;
          overflow: hidden;
          min-height: 40px;
          margin: 0 0 15px;
          color: var(--dv-muted);
          font-size: 12px;
          line-height: 1.6;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .dv-card-actions { display: flex; align-items: center; gap: 8px; }
        .dv-card-actions .dv-button-primary { flex: 1; min-width: 0; padding: 10px 8px; font-size: 12px; }

        .dv-favorite-button {
          display: grid;
          width: 39px;
          height: 39px;
          flex-shrink: 0;
          place-items: center;
          border: 1px solid var(--dv-border);
          border-radius: 10px;
          background: var(--dv-panel-2);
          color: white;
          font-size: 20px;
        }

        .dv-favorite-button.active { color: #fb7185; border-color: rgba(251,113,133,.4); }
        .dv-empty, .dv-message { padding: 40px 15px; text-align: center; color: var(--dv-muted); }
        .dv-empty span { color: #c084fc; font-size: 35px; }
        .dv-empty h3 { color: white; }

        .dv-detail { max-width: 1050px; margin: 15px auto; }
        .dv-back { margin-bottom: 20px; padding: 9px 0; color: #d8b4fe; border: 0; background: transparent; }

        .dv-detail-header {
          display: grid;
          grid-template-columns: minmax(190px, 280px) minmax(0, 1fr);
          gap: 30px;
          align-items: start;
          padding: 22px;
          border: 1px solid var(--dv-border);
          border-radius: 20px;
          background: var(--dv-panel);
        }

        .dv-detail-cover {
          display: block;
          width: 100%;
          max-height: 390px;
          aspect-ratio: 3 / 4;
          object-fit: cover;
          border-radius: 13px;
          background: var(--dv-panel-2);
        }

        .dv-detail-info { min-width: 0; }

        .dv-detail-info h1 {
          margin: 9px 0 15px;
          font-size: clamp(25px, 4vw, 38px);
          line-height: 1.15;
          overflow-wrap: anywhere;
        }

        .dv-detail-info p { color: #b8bac9; line-height: 1.8; white-space: pre-wrap; overflow-wrap: anywhere; }
        .dv-detail-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }

        .dv-description-toggle {
          padding: 10px 14px;
          color: white;
          border: 1px solid var(--dv-border);
          border-radius: 10px;
          background: var(--dv-panel-2);
        }

        .dv-episodes { min-width: 0; margin-top: 28px; }
        .dv-episodes h2 { margin-bottom: 16px; }
        .dv-episode-list { display: grid; gap: 10px; min-width: 0; }

        .dv-episode {
          display: flex;
          align-items: center;
          gap: 14px;
          width: 100%;
          min-width: 0;
          padding: 13px;
          text-align: left;
          color: white;
          border: 1px solid var(--dv-border);
          border-radius: 13px;
          background: var(--dv-panel);
          transition: border-color .2s, background .2s;
        }

        .dv-episode:hover { border-color: var(--dv-accent); background: #191522; }

        .dv-episode-number {
          display: grid;
          width: 44px;
          height: 44px;
          flex-shrink: 0;
          place-items: center;
          border-radius: 10px;
          background: rgba(168,85,247,.15);
          color: #d8b4fe;
          font-weight: 900;
        }

        .dv-episode-info { flex: 1; min-width: 0; overflow-wrap: anywhere; }
        .dv-episode-info strong { display: block; overflow-wrap: anywhere; }
        .dv-episode-info small { display: block; margin-top: 5px; color: var(--dv-muted); }
        .dv-episode-play { flex-shrink: 0; color: #d8b4fe; font-size: 20px; }

        /* Perfil */
        .dv-profile {
          max-width: 900px;
          margin: 10px auto;
        }

        .dv-profile-hero {
          display: flex;
          align-items: center;
          gap: 18px;
          padding: 25px;
          border: 1px solid var(--dv-border);
          border-radius: 20px;
          background:
            radial-gradient(ellipse at top right, rgba(236,72,153,.15), transparent 40%),
            linear-gradient(135deg, #171321, #11131b);
        }

        .dv-profile-avatar {
          display: grid;
          width: 76px;
          height: 76px;
          flex-shrink: 0;
          place-items: center;
          border: 1px solid rgba(192,132,252,.4);
          border-radius: 50%;
          background: rgba(168,85,247,.18);
          color: #e9d5ff;
          font-size: 32px;
        }

        .dv-profile-hero h1 { margin: 0 0 8px; font-size: clamp(23px, 4vw, 32px); }
        .dv-profile-hero p { margin: 0; color: var(--dv-muted); line-height: 1.6; }

        .dv-profile-stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin: 20px 0;
        }

        .dv-profile-stat {
          padding: 20px;
          border: 1px solid var(--dv-border);
          border-radius: 15px;
          background: var(--dv-panel);
        }

        .dv-profile-stat strong {
          display: block;
          margin-bottom: 6px;
          color: #d8b4fe;
          font-size: 28px;
        }

        .dv-profile-stat span { color: var(--dv-muted); font-size: 13px; }

        .dv-profile-panel {
          margin-top: 18px;
          padding: 20px;
          border: 1px solid var(--dv-border);
          border-radius: 15px;
          background: var(--dv-panel);
        }

        .dv-profile-panel h2 { margin-top: 0; font-size: 18px; }
        .dv-profile-panel p { color: var(--dv-muted); font-size: 14px; line-height: 1.7; }

        .dv-profile-action {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          width: 100%;
          padding: 14px 0;
          color: white;
          text-align: left;
          border: 0;
          border-top: 1px solid var(--dv-border);
          background: transparent;
        }

        .dv-profile-action span:last-child { color: #c084fc; font-size: 20px; }

        .dv-player-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: auto;
          padding: 12px;
          background: rgba(0,0,0,.94);
          backdrop-filter: blur(12px);
          overscroll-behavior: contain;
        }

        .dv-player-modal {
          position: relative;
          display: flex;
          flex-direction: column;
          flex: 0 0 auto;
          width: min(100%, 900px);
          max-height: calc(100dvh - 24px);
          min-height: 0;
          overflow: auto;
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 16px;
          background: #0d0e14;
          box-shadow: 0 25px 90px rgba(0,0,0,.55);
          overscroll-behavior: contain;
        }

        .dv-player-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex: 0 0 auto;
          gap: 12px;
          min-height: 58px;
          padding: 10px 14px;
          border-bottom: 1px solid var(--dv-border);
        }

        .dv-player-heading { min-width: 0; }

        .dv-player-heading strong {
          display: block;
          overflow: hidden;
          font-size: 14px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .dv-player-heading small { display: block; margin-top: 4px; color: var(--dv-muted); }

        .dv-player-close {
          display: grid;
          width: 42px;
          height: 42px;
          flex-shrink: 0;
          place-items: center;
          color: white;
          border: 1px solid var(--dv-border);
          border-radius: 50%;
          background: #20212b;
          font-size: 25px;
          line-height: 1;
          touch-action: manipulation;
        }

        .dv-player-close:hover { background: #343544; }

        .dv-video-wrap {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 0 1 auto;
          min-width: 0;
          min-height: 0;
          margin: 0 auto;
          overflow: hidden;
          background: #000;
        }

        .dv-video-wrap--portrait {
          width: min(100%, 430px, calc((100dvh - 160px) * 9 / 16));
          aspect-ratio: 9 / 16;
          max-height: calc(100dvh - 160px);
        }

        .dv-video-wrap--landscape {
          width: min(100%, calc((100dvh - 160px) * 16 / 9));
          aspect-ratio: 16 / 9;
          max-height: calc(100dvh - 160px);
        }

        .dv-video {
          display: block;
          width: 100%;
          height: 100%;
          min-width: 0;
          min-height: 0;
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          background: #000;
        }

        .dv-player-error {
          flex: 0 0 auto;
          padding: 14px 16px;
          color: #fecaca;
          text-align: center;
          line-height: 1.7;
          overflow-wrap: anywhere;
        }

        .dv-player-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex: 0 0 auto;
          gap: 10px;
          min-height: 58px;
          padding: 10px 12px;
          border-top: 1px solid var(--dv-border);
        }

        .dv-player-bottom span {
          min-width: 0;
          overflow: hidden;
          color: var(--dv-muted);
          font-size: 12px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .dv-player-next {
          flex: 0 0 auto;
          min-height: 40px;
          padding: 10px 13px;
          color: white;
          border: 0;
          border-radius: 9px;
          background: #7c3aed;
          font-size: 12px;
          font-weight: 800;
          touch-action: manipulation;
        }

        .dv-player-next:disabled { cursor: not-allowed; opacity: .45; }

        .dv-footer {
          padding: 25px 16px;
          border-top: 1px solid var(--dv-border);
          color: var(--dv-muted);
          text-align: center;
          font-size: 12px;
        }

        @media (min-width: 1500px) {
          .dv-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); }
        }

        @media (max-width: 1050px) {
          .dv-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .dv-header { padding-inline: 22px; }
          .dv-main { padding-inline: 22px; }
        }

        @media (max-width: 760px) {
          .dv-header { flex-wrap: wrap; gap: 12px; padding: 13px 16px; }
          .dv-logo { font-size: 22px; }
          .dv-search { order: 3; width: 100%; }

          .dv-nav {
            position: fixed;
            right: 0;
            bottom: 0;
            left: 0;
            z-index: 90;
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            justify-content: stretch;
            gap: 0;
            padding: 7px 5px calc(7px + env(safe-area-inset-bottom));
            overflow: visible;
            border-top: 1px solid rgba(255,255,255,.1);
            border-bottom: 0;
            background: rgba(12,12,19,.97);
            backdrop-filter: blur(18px);
          }

          .dv-nav button {
            display: flex;
            min-width: 0;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 4px;
            padding: 7px 2px;
            border-radius: 10px;
          }

          .dv-nav-icon { font-size: 21px; }
          .dv-nav-label { font-size: 10px; }

          .dv-development-notice {
            width: calc(100% - 24px);
            margin-top: 13px;
            padding: 14px;
            gap: 11px;
          }

          .dv-development-icon { width: 36px; height: 36px; font-size: 19px; }
          .dv-development-content h2 { font-size: 13px; line-height: 1.5; }
          .dv-development-content p { font-size: 12px; }
          .dv-main { padding: 18px 15px 95px; }

          .dv-hero { min-height: 255px; margin-top: 3px; border-radius: 18px; }
          .dv-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 10px;
          }

          .dv-card { border-radius: 10px; }
          .dv-card-content { padding: 9px; }
          .dv-card h3 { font-size: 12px; line-height: 1.4; }
          .dv-card p { min-height: 0; margin-bottom: 10px; font-size: 10px; }
          .dv-card-actions { gap: 5px; }
          .dv-card-actions .dv-button-primary { padding: 9px 5px; font-size: 10px; }
          .dv-favorite-button { width: 32px; height: 34px; font-size: 17px; }
          .dv-card-play { width: 32px; height: 32px; right: 7px; bottom: 7px; }
          .dv-card-category { font-size: 8px; letter-spacing: .6px; }

          .dv-detail-header { grid-template-columns: 1fr; gap: 18px; padding: 15px; }
          .dv-detail-cover { width: min(100%, 260px); margin: 0 auto; }
          .dv-detail-info h1 { font-size: 27px; }
          .dv-episode { gap: 10px; padding: 10px; }

          .dv-profile-hero { padding: 18px; gap: 13px; }
          .dv-profile-avatar { width: 60px; height: 60px; font-size: 26px; }
          .dv-profile-stats { gap: 10px; }
          .dv-profile-stat { padding: 15px; }
          .dv-profile-stat strong { font-size: 24px; }
          .dv-profile-panel { padding: 16px; }

          .dv-player-overlay {
            align-items: center;
            padding: 0;
          }

          .dv-player-modal {
            width: 100%;
            max-height: 100dvh;
            border-radius: 0;
            border: 0;
          }

          .dv-video-wrap--portrait {
            width: min(100%, 430px, calc((100dvh - 132px) * 9 / 16));
            max-height: calc(100dvh - 132px);
          }

          .dv-video-wrap--landscape {
            width: min(100%, calc((100dvh - 132px) * 16 / 9));
            max-height: calc(100dvh - 132px);
          }
        }

        @media (max-width: 360px) {
          .dv-grid { gap: 7px; }
          .dv-card-content { padding: 7px; }
          .dv-card h3 { font-size: 11px; }
          .dv-card-actions .dv-button-primary { font-size: 9px; }
          .dv-nav-label { font-size: 9px; }
        }

        @media (max-height: 520px) {
          .dv-player-overlay { align-items: flex-start; }
          .dv-player-modal { margin-block: 4px; max-height: none; }

          .dv-video-wrap--portrait {
            width: min(100%, calc((100dvh - 130px) * 9 / 16));
            max-height: calc(100dvh - 130px);
          }

          .dv-video-wrap--landscape {
            width: min(100%, calc((100dvh - 130px) * 16 / 9));
            max-height: calc(100dvh - 130px);
          }
        }
      `}</style>

      <header className="dv-header">
        <button
          className="dv-logo"
          onClick={() => goToPage("inicio")}
          aria-label="DRAMOVIX início"
        >
          DRAMOVIX<span>+</span>
        </button>

        <label className="dv-search">
          <span>⌕</span>
          <input
            type="search"
            placeholder="Buscar histórias..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);

              if (page === "inicio" || page === "perfil") {
                setPage("minisseries");
              }
            }}
          />
        </label>
      </header>

      <nav className="dv-nav" aria-label="Navegação principal">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            className={page === item.key ? "active" : ""}
            onClick={() => goToPage(item.key)}
            aria-label={item.label}
            aria-current={page === item.key ? "page" : undefined}
          >
            <span className="dv-nav-icon" aria-hidden="true">
              {item.key === "favoritos" && favoriteCount > 0
                ? "♥"
                : item.icon}
            </span>

            <span className="dv-nav-label">
              {item.key === "favoritos"
                ? `${item.label}${favoriteCount ? ` (${favoriteCount})` : ""}`
                : item.label}
            </span>
          </button>
        ))}
      </nav>

      {/* AVISO DE DESENVOLVIMENTO — MANTIDO INTENCIONALMENTE */}
      <aside
        className="dv-development-notice"
        role="status"
        aria-label="Aviso de desenvolvimento"
      >
        <div className="dv-development-icon" aria-hidden="true">
          🚧
        </div>

        <div className="dv-development-content">
          <h2>O DRAMOVIX AINDA ESTÁ EM DESENVOLVIMENTO</h2>

          <p>
            Estamos preparando muitas novidades para você!
            Algumas séries ainda não possuem episódios disponíveis,
            e outras ainda não chegaram ao catálogo.
            <strong>
              {" "}Em breve teremos novas histórias e mais episódios.
            </strong>
            {" "}Obrigado pela paciência e por fazer parte dessa história! ❤️
          </p>
        </div>
      </aside>

      <main className="dv-main">
        {page === "detalhes" && selectedSeries && (
          <section className="dv-detail">
            <button
              className="dv-back"
              onClick={() => goToPage("minisseries")}
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
                <span className="dv-eyebrow">
                  {selectedSeries.category || "MINISSÉRIE"}
                </span>

                <h1>{selectedSeries.title}</h1>

                <p>
                  {showDescription
                    ? selectedSeries.description ||
                      "Descrição indisponível."
                    : (
                        selectedSeries.description ||
                        "Uma nova história espera por você."
                      ).slice(0, 180) +
                      ((selectedSeries.description || "").length > 180
                        ? "..."
                        : "")}
                </p>

                {(selectedSeries.description || "").length > 180 && (
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
                    ▶ Assistir primeiro episódio
                  </button>

                  <button
                    className="dv-description-toggle"
                    onClick={() => toggleFavorite(selectedSeries)}
                  >
                    {isFavorite(selectedSeries)
                      ? "♥ Nos favoritos"
                      : "♡ Adicionar aos favoritos"}
                  </button>
                </div>
              </div>
            </div>

            <section className="dv-episodes">
              <div className="dv-section-heading">
                <div>
                  <h2>Episódios</h2>
                  <p>
                    {episodes.length} episódio
                    {episodes.length === 1 ? "" : "s"} disponível
                    {episodes.length === 1 ? "" : "is"}
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

                        <small>
                          {episode.video_url
                            ? "▶ Pronto para assistir"
                            : "Link ainda não configurado"}
                        </small>
                      </span>

                      <span className="dv-episode-play">▶</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="dv-empty">
                  <h3>Esta história está chegando!</h3>
                  <p>
                    Esta série ainda não possui episódios disponíveis.
                    Estamos trabalhando para trazer novidades ao DRAMOVIX.
                    Volte em breve para conferir as atualizações! ❤️
                  </p>
                </div>
              )}
            </section>
          </section>
        )}

        {page === "inicio" && (
          <>
            <section className="dv-hero">
              <div className="dv-hero-content">
                <span className="dv-eyebrow">
                  ✦ DRAMOVIX+ ORIGINAL
                </span>

                <h1>Sempre tem uma nova história.</h1>

                <p>
                  Romance, vingança, suspense e histórias que prendem
                  você do primeiro ao último episódio.
                </p>

                <button
                  className="dv-button-primary"
                  onClick={() => goToPage("minisseries")}
                >
                  Explorar catálogo →
                </button>
              </div>
            </section>

            <section className="dv-section">
              <div className="dv-section-heading">
                <div>
                  <h2>Escolha seu clima</h2>
                  <p>Histórias para cada momento.</p>
                </div>
              </div>

              <div className="dv-categories">
                {categories.map((item) => (
                  <button
                    key={item}
                    className={`dv-category-button ${
                      category === item ? "active" : ""
                    }`}
                    onClick={() => {
                      setCategory(item);
                      setPage("minisseries");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </section>

            <section className="dv-section">
              <div className="dv-section-heading">
                <div>
                  <h2>Em destaque</h2>
                  <p>Descubra sua próxima história favorita.</p>
                </div>

                <button
                  className="dv-description-toggle"
                  onClick={() => goToPage("minisseries")}
                >
                  Ver catálogo →
                </button>
              </div>

              {renderGrid(filteredSeries.slice(0, 8))}
            </section>

            <section className="dv-section">
              <div className="dv-section-heading">
                <div>
                  <h2>Canais ao vivo</h2>
                  <p>Assista às transmissões disponíveis.</p>
                </div>

                <button
                  className="dv-description-toggle"
                  onClick={() => goToPage("ao-vivo")}
                >
                  Ver todos →
                </button>
              </div>

              {liveChannelsLoading ? (
                <p className="dv-message">
                  Carregando canais ao vivo...
                </p>
              ) : (
                renderGrid(
                  [
                    ...liveChannels.slice(0, 4),
                    ...(liveChannels.some(
                      (item) =>
                        normalize(item.title) ===
                        normalize("Z Nation")
                    )
                      ? []
                      : [LIVE_SERIES]),
                  ].slice(0, 4),
                  "live"
                )
              )}
            </section>

            {movies.length > 0 && (
              <section className="dv-section">
                <div className="dv-section-heading">
                  <div>
                    <h2>Filmes para você</h2>
                    <p>Escolha e comece a assistir.</p>
                  </div>

                  <button
                    className="dv-description-toggle"
                    onClick={() => goToPage("filmes")}
                  >
                    Ver filmes →
                  </button>
                </div>

                {renderGrid(
                  filteredMovies.slice(0, 4),
                  "movie"
                )}
              </section>
            )}
          </>
        )}

        {page === "minisseries" && (
          <section className="dv-section">
            <div className="dv-section-heading">
              <div>
                <h2>Minisséries</h2>
                <p>Encontre sua próxima maratona.</p>
              </div>
            </div>

            <div className="dv-categories">
              {categories.map((item) => (
                <button
                  key={item}
                  className={`dv-category-button ${
                    category === item ? "active" : ""
                  }`}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>

            {renderGrid(filteredSeries)}
          </section>
        )}

        {page === "filmes" && (
          <section className="dv-section">
            <div className="dv-section-heading">
              <div>
                <h2>Filmes</h2>
                <p>Seus filmes disponíveis no catálogo.</p>
              </div>
            </div>

            {renderGrid(filteredMovies, "movie")}
          </section>
        )}

        {page === "ao-vivo" && (
          <section className="dv-section">
            <div className="dv-section-heading">
              <div>
                <h2>Ao vivo</h2>
                <p>Transmissões disponíveis.</p>
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
                  ...(liveChannels.some(
                    (item) =>
                      normalize(item.title) ===
                      normalize("Z Nation")
                  )
                    ? []
                    : [LIVE_SERIES]),
                ],
                "live"
              )
            )}
          </section>
        )}

        {page === "favoritos" && (
          <>
            <section className="dv-section">
              <div className="dv-section-heading">
                <div>
                  <h2>Meus favoritos</h2>
                  <p>Suas histórias salvas neste dispositivo.</p>
                </div>
              </div>

              {renderGrid(favoriteSeries)}
            </section>

            {favoriteMovies.length > 0 && (
              <section className="dv-section">
                <div className="dv-section-heading">
                  <div>
                    <h2>Filmes favoritos</h2>
                  </div>
                </div>

                {renderGrid(favoriteMovies, "movie")}
              </section>
            )}
          </>
        )}

        {page === "perfil" && (
          <section className="dv-profile">
            <div className="dv-profile-hero">
              <div className="dv-profile-avatar" aria-hidden="true">
                ♙
              </div>

              <div>
                <span className="dv-eyebrow">SUA EXPERIÊNCIA</span>
                <h1>Meu perfil</h1>
                <p>
                  Seu espaço no DRAMOVIX. Personalização de conta
                  estará disponível em uma próxima atualização.
                </p>
              </div>
            </div>

            <div className="dv-profile-stats">
              <div className="dv-profile-stat">
                <strong>{favoriteSeries.length}</strong>
                <span>Minisséries favoritas</span>
              </div>

              <div className="dv-profile-stat">
                <strong>{favoriteMovies.length}</strong>
                <span>Filmes favoritos</span>
              </div>
            </div>

            <div className="dv-profile-panel">
              <h2>Minha biblioteca</h2>

              <button
                className="dv-profile-action"
                onClick={() => goToPage("favoritos")}
              >
                <span>♡ Meus favoritos</span>
                <span>›</span>
              </button>

              <button
                className="dv-profile-action"
                onClick={() => goToPage("minisseries")}
              >
                <span>▤ Explorar minisséries</span>
                <span>›</span>
              </button>

              <button
                className="dv-profile-action"
                onClick={() => goToPage("filmes")}
              >
                <span>▣ Explorar filmes</span>
                <span>›</span>
              </button>

              <button
                className="dv-profile-action"
                onClick={() => goToPage("ao-vivo")}
              >
                <span>◉ Assistir ao vivo</span>
                <span>›</span>
              </button>
            </div>

            <div className="dv-profile-panel">
              <h2>Sobre o DRAMOVIX</h2>
              <p>
                O DRAMOVIX ainda está em desenvolvimento. Novos recursos,
                incluindo personalização de perfil, poderão ser adicionados
                futuramente.
              </p>
              <p>
                Seus favoritos atuais ficam salvos neste dispositivo.
                Esta tela ainda não representa uma conta com login.
              </p>
            </div>
          </section>
        )}
      </main>

      <footer className="dv-footer">
        DRAMOVIX+ · Sempre tem uma nova história.
        <p>
          Plataforma em desenvolvimento. Novidades chegando em breve! ❤️
        </p>
      </footer>

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
            aria-label="Player de vídeo"
          >
            <div className="dv-player-top">
              <div className="dv-player-heading">
                <strong>
                  {selectedEpisode?.title ||
                    selectedSeries?.title ||
                    "Reproduzindo"}
                </strong>

                <small>
                  {selectedEpisode?.isLive
                    ? "Transmissão ao vivo"
                    : selectedEpisode?.isMovie
                      ? "Filme"
                      : selectedSeries?.title || "DRAMOVIX+"}
                </small>
              </div>

              <button
                className="dv-player-close"
                onClick={closePlayer}
                aria-label="Fechar player"
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
                key={selectedEpisode?.id || "dramovix-video"}
                ref={videoRef}
                className="dv-video"
                controls
                playsInline
                preload="metadata"
                onEnded={handleVideoEnded}
              />
            </div>

            {playerError && (
              <div className="dv-player-error" role="alert">
                {playerError}
              </div>
            )}

            <div className="dv-player-bottom">
              <span>
                {selectedEpisode?.isLive
                  ? "Transmissão ao vivo"
                  : selectedEpisode?.isMovie
                    ? "Filme · DRAMOVIX+"
                    : selectedEpisode?.episode_number
                      ? `Episódio ${
                          selectedEpisode.episode_number
                        } · Temporada ${
                          selectedEpisode.season_number || 4
                        }`
                      : "DRAMOVIX+"}
              </span>

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
