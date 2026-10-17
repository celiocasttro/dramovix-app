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

const TOP_TABS = [
  { key: "descobrir", label: "Descobrir" },
  { key: "novo", label: "Novo" },
  { key: "rankings", label: "Rankings" },
  { key: "categorias", label: "Categorias" },
];

const BOTTOM_TABS = [
  { key: "inicio", label: "Início", icon: "⌂" },
  { key: "para-voce", label: "Para Você", icon: "▷" },
  { key: "beneficios", label: "Benefícios", icon: "♔" },
  { key: "favoritos", label: "Favoritos", icon: "♡" },
  { key: "perfil", label: "Perfil", icon: "♙" },
];

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

  const [liveChannelsLoading, setLiveChannelsLoading] =
    useState(true);

  const [selectedSeries, setSelectedSeries] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [selectedEpisode, setSelectedEpisode] = useState(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");

  const [page, setPage] = useState("inicio");
  const [topTab, setTopTab] = useState("descobrir");

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
    try {
      localStorage.setItem(
        "dramovix-favorites",
        JSON.stringify(favorites)
      );
    } catch (error) {
      console.error(
        "Não foi possível salvar os favoritos:",
        error
      );
    }
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
            created_at: item.created_at,
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
            created_at: item.created_at,
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
            liveChannelsResult.error
              ? []
              : loadedLiveChannels
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
      setEpisodes([]);

      try {
        if (!selectedSeries.dbId) {
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
        console.error(
          "Erro ao carregar episódios:",
          error
        );

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
    if (
      !playerOpen ||
      !selectedEpisode ||
      !videoRef.current
    ) {
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
    video.addEventListener(
      "loadedmetadata",
      handleMetadata
    );

    if (isHls && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });

      hlsRef.current = hls;

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        if (!cancelled) {
          hls.loadSource(url);
        }
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
      video.canPlayType(
        "application/vnd.apple.mpegurl"
      )
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

      video.removeEventListener(
        "error",
        handleVideoError
      );

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

  useEffect(() => {
    if (!playerOpen) return;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [playerOpen]);

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
      normalize(item.title).includes(
        normalize(search)
      ) ||
      normalize(item.description).includes(
        normalize(search)
      );

    const matchesCategory =
      category === "Todas" ||
      item.category === category;

    return matchesSearch && matchesCategory;
  });

  const filteredMovies = movies.filter((item) => {
    const matchesSearch =
      normalize(item.title).includes(
        normalize(search)
      ) ||
      normalize(item.description).includes(
        normalize(search)
      );

    return matchesSearch;
  });

  const filteredLiveChannels = liveChannels.filter(
    (item) => {
      const matchesSearch =
        normalize(item.title).includes(
          normalize(search)
        ) ||
        normalize(item.description).includes(
          normalize(search)
        );

      return matchesSearch;
    }
  );

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
      (episode) =>
        episode.id === selectedEpisode.id
    );

    if (
      currentIndex >= 0 &&
      currentIndex < episodes.length - 1
    ) {
      openPlayer(episodes[currentIndex + 1]);
    }
  }

  function handleVideoEnded() {
    if (
      selectedEpisode?.isLive ||
      selectedEpisode?.isMovie
    ) {
      return;
    }

    playNextEpisode();
  }

  function goToPage(nextPage) {
    setPage(nextPage);
    setSelectedSeries(null);
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

  function goToTopTab(nextTab) {
    setTopTab(nextTab);
    setSelectedSeries(null);
    setSelectedEpisode(null);
    setEpisodes([]);
    setSearch("");
    setCategory("Todas");

    if (
      nextTab === "descobrir" ||
      nextTab === "novo" ||
      nextTab === "rankings" ||
      nextTab === "categorias"
    ) {
      setPage("inicio");
    }

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

          {type === "live" && (
            <span className="dv-live-badge">
              AO VIVO
            </span>
          )}

          <span className="dv-card-play">▶</span>
        </button>

        <div className="dv-card-content">
          <span className="dv-card-category">
            {type === "live"
              ? "AO VIVO"
              : item.category}
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
              ▶{" "}
              {type === "series"
                ? "Ver detalhes"
                : "Assistir"}
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
        <p className="dv-message">
          Carregando catálogo...
        </p>
      );
    }

    if (!items.length) {
      return (
        <div className="dv-empty">
          <span>✦</span>
          <h3>Nada por aqui ainda</h3>
          <p>
            Experimente outra categoria ou faça uma
            nova busca.
          </p>
        </div>
      );
    }

    return (
      <div className="dv-grid">
        {items.map((item) =>
          renderCard(item, type)
        )}
      </div>
    );
  }

  const favoriteSeries = series.filter((item) =>
    isFavorite(item)
  );

  const favoriteMovies = movies.filter((item) =>
    isFavorite(item)
  );

  const favoriteCount =
    favoriteSeries.length + favoriteMovies.length;

  const isLandscapePlayer =
    Boolean(selectedEpisode?.isMovie) ||
    Boolean(selectedEpisode?.isLive) ||
    Boolean(selectedSeries?.isLive);

  const newSeries = [...filteredSeries].sort(
    (a, b) =>
      new Date(b.created_at || 0) -
      new Date(a.created_at || 0)
  );

  const rankingSeries = [...filteredSeries].sort(
    (a, b) =>
      (Number(b.views) || 0) -
      (Number(a.views) || 0)
  );

  const liveItems = [
    ...filteredLiveChannels,
    ...(liveChannels.some(
      (item) =>
        normalize(item.title) ===
        normalize("Z Nation")
    )
      ? []
      : [LIVE_SERIES]),
  ];

  return (
    <div className="dv-app">
      <style>{`
        :root {
          color-scheme: dark;
          --dv-bg: #000;
          --dv-panel: #101010;
          --dv-panel-2: #191919;
          --dv-text: #f7f7fb;
          --dv-muted: #a3a3a3;
          --dv-accent: #f12b68;
          --dv-accent-2: #ff477e;
          --dv-border: rgba(255,255,255,.09);
        }

        * {
          box-sizing: border-box;
        }

        html {
          scroll-behavior: smooth;
        }

        body {
          margin: 0;
          background: var(--dv-bg);
          color: var(--dv-text);
          font-family: Inter, system-ui, -apple-system,
            BlinkMacSystemFont, "Segoe UI", sans-serif;
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
          padding-bottom: 0;
          background: #000;
          color: var(--dv-text);
        }

        .dv-header {
          position: sticky;
          top: 0;
          z-index: 30;
          display: flex;
          align-items: center;
          gap: 14px;
          width: 100%;
          padding: 13px clamp(16px, 4vw, 42px);
          background: rgba(0,0,0,.97);
          border-bottom: 0;
        }

        .dv-logo {
          flex-shrink: 0;
          border: 0;
          background: transparent;
          color: white;
          font-size: 23px;
          font-weight: 950;
          letter-spacing: -1px;
          white-space: nowrap;
        }

        .dv-logo span {
          color: var(--dv-accent);
        }

        .dv-search {
          display: flex;
          align-items: center;
          width: min(420px, 100%);
          min-width: 0;
          margin-left: auto;
          padding: 0 13px;
          border: 1px solid #272727;
          border-radius: 7px;
          background: #202020;
        }

        .dv-search span {
          color: #888;
          font-size: 23px;
        }

        .dv-search input {
          width: 100%;
          min-width: 0;
          padding: 11px;
          border: 0;
          outline: none;
          color: white;
          background: transparent;
        }

        .dv-search input::placeholder {
          color: #888;
        }

        .dv-top-nav {
          position: sticky;
          top: 57px;
          z-index: 25;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: clamp(20px, 5vw, 52px);
          padding: 12px clamp(16px, 4vw, 42px) 0;
          overflow-x: auto;
          scrollbar-width: none;
          background: #000;
        }

        .dv-top-nav::-webkit-scrollbar {
          display: none;
        }

        .dv-top-tab {
          position: relative;
          flex-shrink: 0;
          padding: 8px 0 15px;
          border: 0;
          color: #999;
          background: transparent;
          font-size: clamp(16px, 2.6vw, 23px);
          font-weight: 750;
          white-space: nowrap;
        }

        .dv-top-tab.active {
          color: #fff;
        }

        .dv-top-tab.active::after {
          position: absolute;
          right: 25%;
          bottom: 3px;
          left: 25%;
          height: 3px;
          border-radius: 999px;
          background: #fff;
          content: "";
        }

        .dv-development-notice {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          width: min(1450px, calc(100% - 32px));
          margin: 14px auto 0;
          padding: 13px 15px;
          border: 1px solid rgba(241,43,104,.35);
          border-radius: 12px;
          background: #151015;
        }

        .dv-development-icon {
          display: grid;
          width: 34px;
          height: 34px;
          flex-shrink: 0;
          place-items: center;
          border-radius: 10px;
          background: rgba(241,43,104,.12);
          font-size: 18px;
        }

        .dv-development-content {
          min-width: 0;
        }

        .dv-development-content h2 {
          margin: 0 0 6px;
          color: #ff8eae;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .4px;
        }

        .dv-development-content p {
          margin: 0;
          color: #bdbdbd;
          font-size: 12px;
          line-height: 1.6;
        }

        .dv-development-content strong {
          color: white;
        }

        .dv-main {
          width: min(1450px, 100%);
          min-height: 65vh;
          margin: 0 auto;
          padding: 20px clamp(16px, 4vw, 42px) 35px;
        }

        .dv-hero {
          position: relative;
          display: flex;
          align-items: center;
          min-height: 230px;
          overflow: hidden;
          margin: 5px 0 28px;
          padding: clamp(22px, 5vw, 48px);
          border: 1px solid #292029;
          border-radius: 15px;
          background:
            radial-gradient(
              ellipse at 80% 15%,
              rgba(241,43,104,.3),
              transparent 35%
            ),
            linear-gradient(120deg, #171017, #090909 75%);
        }

        .dv-hero-content {
          position: relative;
          z-index: 1;
          max-width: 650px;
        }

        .dv-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #ff86a9;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.5px;
          text-transform: uppercase;
        }

        .dv-hero h1 {
          margin: 14px 0;
          font-size: clamp(30px, 5vw, 52px);
          line-height: 1.06;
          letter-spacing: -1.5px;
        }

        .dv-hero p {
          max-width: 500px;
          color: #c0c0c0;
          line-height: 1.7;
        }

        .dv-button-primary {
          padding: 10px 14px;
          color: white;
          font-weight: 800;
          border: 0;
          border-radius: 8px;
          background: linear-gradient(
            110deg,
            #e91e63,
            #ff477e
          );
          transition: filter .2s;
        }

        .dv-button-primary:hover {
          filter: brightness(1.12);
        }

        .dv-section {
          margin: 25px 0 34px;
        }

        .dv-section-heading {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }

        .dv-section-heading h2 {
          margin: 0;
          font-size: clamp(20px, 3vw, 27px);
          letter-spacing: -.4px;
        }

        .dv-section-heading p {
          margin: 6px 0 0;
          color: var(--dv-muted);
          font-size: 13px;
        }

        .dv-categories {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
          margin: 15px 0 25px;
        }

        .dv-category-button {
          padding: 9px 14px;
          color: #d1d1d1;
          border: 1px solid #292929;
          border-radius: 999px;
          background: #111;
        }

        .dv-category-button:hover,
        .dv-category-button.active {
          color: white;
          border-color: var(--dv-accent);
          background: rgba(241,43,104,.15);
        }

        .dv-grid {
          display: grid !important;
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          gap: 18px;
          width: 100%;
          min-width: 0;
          overflow: visible !important;
        }

        .dv-card {
          display: block;
          width: auto !important;
          min-width: 0 !important;
          max-width: 100%;
          overflow: hidden;
          border: 0;
          border-radius: 0;
          background: transparent;
        }

        .dv-card-image-button {
          position: relative;
          display: block;
          width: 100%;
          aspect-ratio: 3 / 4;
          overflow: hidden;
          padding: 0;
          border: 0;
          border-radius: 3px;
          background: #202020;
        }

        .dv-card-image {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform .3s;
        }

        .dv-card:hover .dv-card-image {
          transform: scale(1.035);
        }

        .dv-card-play {
          position: absolute;
          right: 8px;
          bottom: 8px;
          color: white;
          font-size: 13px;
          text-shadow: 0 1px 5px #000;
        }

        .dv-live-badge {
          position: absolute;
          top: 7px;
          left: 7px;
          padding: 5px 7px;
          border-radius: 4px;
          color: white;
          background: #e51c48;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .5px;
        }

        .dv-card-content {
          min-width: 0;
          padding: 9px 1px 0;
        }

        .dv-card-category {
          display: block;
          margin: 4px 0 0;
          color: #999;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0;
          text-transform: none;
        }

        .dv-card h3 {
          display: -webkit-box;
          overflow: hidden;
          min-height: 2.7em;
          margin: 0 0 6px;
          color: white;
          font-size: 15px;
          font-weight: 500;
          line-height: 1.35;
          overflow-wrap: anywhere;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .dv-card p {
          display: none;
        }

        .dv-card-actions {
          display: none;
        }

        .dv-favorite-button {
          display: grid;
          width: 32px;
          height: 32px;
          flex-shrink: 0;
          place-items: center;
          border: 1px solid #333;
          border-radius: 8px;
          background: #191919;
          color: white;
          font-size: 18px;
        }

        .dv-favorite-button.active {
          color: #fb7185;
          border-color: rgba(251,113,133,.4);
        }

        .dv-empty,
        .dv-message {
          padding: 35px 15px;
          color: var(--dv-muted);
          text-align: center;
        }

        .dv-empty span {
          color: #ff477e;
          font-size: 32px;
        }

        .dv-empty h3 {
          color: white;
        }

        .dv-detail {
          max-width: 1050px;
          min-width: 0;
          margin: 15px auto;
        }

        .dv-back {
          margin-bottom: 18px;
          padding: 9px 0;
          color: #ff86a9;
          border: 0;
          background: transparent;
        }

        .dv-detail-header {
          display: grid;
          grid-template-columns: minmax(180px, 260px) minmax(0, 1fr);
          gap: 25px;
          align-items: start;
          min-width: 0;
          padding: 18px;
          border: 1px solid var(--dv-border);
          border-radius: 15px;
          background: #101010;
        }

        .dv-detail-cover {
          display: block;
          width: 100%;
          max-height: 390px;
          aspect-ratio: 3 / 4;
          object-fit: cover;
          border-radius: 9px;
          background: #191919;
        }

        .dv-detail-info {
          min-width: 0;
        }

        .dv-detail-info h1 {
          margin: 9px 0 14px;
          font-size: clamp(24px, 4vw, 36px);
          line-height: 1.15;
          overflow-wrap: anywhere;
        }

        .dv-detail-info p {
          color: #b8b8b8;
          line-height: 1.8;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .dv-detail-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 20px;
        }

        .dv-description-toggle {
          padding: 10px 13px;
          color: white;
          border: 1px solid #333;
          border-radius: 8px;
          background: #191919;
        }

        .dv-episodes {
          min-width: 0;
          margin-top: 25px;
        }

        .dv-episodes h2 {
          margin-bottom: 14px;
        }

        .dv-episode-list {
          display: grid;
          gap: 9px;
          min-width: 0;
        }

        .dv-episode {
          display: flex;
          align-items: center;
          gap: 13px;
          width: 100%;
          min-width: 0;
          padding: 12px;
          text-align: left;
          color: white;
          border: 1px solid #292929;
          border-radius: 10px;
          background: #101010;
        }

        .dv-episode:hover {
          border-color: var(--dv-accent);
          background: #171117;
        }

        .dv-episode-number {
          display: grid;
          width: 42px;
          height: 42px;
          flex-shrink: 0;
          place-items: center;
          border-radius: 8px;
          background: rgba(241,43,104,.12);
          color: #ff86a9;
          font-weight: 900;
        }

        .dv-episode-info {
          flex: 1;
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .dv-episode-info strong {
          display: block;
          overflow-wrap: anywhere;
          line-height: 1.45;
        }

        .dv-episode-info small {
          display: block;
          margin-top: 5px;
          color: var(--dv-muted);
          line-height: 1.5;
        }

        .dv-episode-play {
          flex-shrink: 0;
          color: #ff86a9;
          font-size: 20px;
        }

        .dv-profile {
          max-width: 900px;
          margin: 10px auto;
        }

        .dv-profile-hero {
          display: flex;
          align-items: center;
          gap: 18px;
          padding: 23px;
          border: 1px solid #292929;
          border-radius: 15px;
          background: #111;
        }

        .dv-profile-avatar {
          display: grid;
          width: 70px;
          height: 70px;
          flex-shrink: 0;
          place-items: center;
          border: 1px solid rgba(241,43,104,.4);
          border-radius: 50%;
          background: rgba(241,43,104,.12);
          color: #ffb2c7;
          font-size: 30px;
        }

        .dv-profile-hero h1 {
          margin: 0 0 8px;
          font-size: clamp(23px, 4vw, 32px);
        }

        .dv-profile-hero p {
          margin: 0;
          color: var(--dv-muted);
          line-height: 1.6;
        }

        .dv-profile-stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 13px;
          margin: 18px 0;
        }

        .dv-profile-stat {
          padding: 18px;
          border: 1px solid #292929;
          border-radius: 12px;
          background: #101010;
        }

        .dv-profile-stat strong {
          display: block;
          margin-bottom: 6px;
          color: #ff86a9;
          font-size: 26px;
        }

        .dv-profile-stat span {
          color: var(--dv-muted);
          font-size: 13px;
        }

        .dv-profile-panel {
          margin-top: 17px;
          padding: 18px;
          border: 1px solid #292929;
          border-radius: 12px;
          background: #101010;
        }

        .dv-profile-panel h2 {
          margin-top: 0;
          font-size: 18px;
        }

        .dv-profile-panel p {
          color: var(--dv-muted);
          font-size: 14px;
          line-height: 1.7;
        }

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
          border-top: 1px solid #292929;
          background: transparent;
        }

        .dv-profile-action span:last-child {
          color: #ff86a9;
          font-size: 20px;
        }

        .dv-benefits-panel {
          padding: 25px;
          border: 1px solid #292929;
          border-radius: 14px;
          background: #101010;
        }

        .dv-benefits-panel h2 {
          margin-top: 0;
        }

        .dv-benefits-panel p {
          color: #aaa;
          line-height: 1.7;
        }

        .dv-player-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: auto;
          padding: 12px;
          background: rgba(0,0,0,.96);
          backdrop-filter: blur(10px);
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
          border-radius: 12px;
          background: #090909;
          overscroll-behavior: contain;
        }

        .dv-player-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex: 0 0 auto;
          gap: 12px;
          min-height: 55px;
          padding: 9px 13px;
          border-bottom: 1px solid #292929;
        }

        .dv-player-heading {
          min-width: 0;
        }

        .dv-player-heading strong {
          display: block;
          overflow: hidden;
          font-size: 14px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .dv-player-heading small {
          display: block;
          margin-top: 4px;
          color: var(--dv-muted);
        }

        .dv-player-close {
          display: grid;
          width: 40px;
          height: 40px;
          flex-shrink: 0;
          place-items: center;
          color: white;
          border: 1px solid #333;
          border-radius: 50%;
          background: #202020;
          font-size: 25px;
          line-height: 1;
          touch-action: manipulation;
        }

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
          min-height: 55px;
          padding: 9px 12px;
          border-top: 1px solid #292929;
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
          min-height: 39px;
          padding: 9px 12px;
          color: white;
          border: 0;
          border-radius: 8px;
          background: #e91e63;
          font-size: 12px;
          font-weight: 800;
          touch-action: manipulation;
        }

        .dv-player-next:disabled {
          cursor: not-allowed;
          opacity: .45;
        }

        .dv-footer {
          padding: 25px 16px 100px;
          border-top: 1px solid #222;
          color: #888;
          text-align: center;
          font-size: 12px;
        }

        .dv-footer p {
          margin-bottom: 0;
        }

        @media (min-width: 1500px) {
          .dv-grid {
            grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 1050px) {
          .dv-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 760px) {
          .dv-header {
            display: flex;
            flex-wrap: nowrap;
            gap: 10px;
            padding: 12px 16px 8px;
          }

          .dv-logo {
            display: none;
          }

          .dv-search {
            width: 100%;
            min-width: 0;
            margin: 0;
          }

          .dv-top-nav {
            top: 0;
            gap: clamp(18px, 6vw, 32px);
            padding: 12px 16px 0;
          }

          .dv-top-tab {
            font-size: clamp(17px, 4.5vw, 23px);
          }

          .dv-development-notice {
            width: calc(100% - 24px);
            margin-top: 12px;
            padding: 12px;
            gap: 10px;
          }

          .dv-development-icon {
            width: 32px;
            height: 32px;
            font-size: 17px;
          }

          .dv-development-content h2 {
            font-size: 11px;
            line-height: 1.5;
          }

          .dv-development-content p {
            font-size: 11px;
          }

          .dv-main {
            padding: 15px 15px 100px;
          }

          .dv-hero {
            min-height: 230px;
            margin-top: 4px;
            border-radius: 12px;
          }

          .dv-grid {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 12px 10px;
            width: 100%;
            min-width: 0;
            overflow: visible !important;
          }

          .dv-card {
            display: block;
            width: auto !important;
            min-width: 0 !important;
            max-width: 100%;
            flex: initial !important;
            overflow: hidden;
          }

          .dv-card-image-button {
            display: block;
            width: 100% !important;
            aspect-ratio: 3 / 4;
          }

          .dv-card-content {
            padding: 7px 1px 0;
          }

          .dv-card h3 {
            min-height: 2.7em;
            margin: 0 0 5px;
            font-size: 12px;
            font-weight: 500;
            line-height: 1.4;
          }

          .dv-card-category {
            margin-top: 3px;
            font-size: 10px;
          }

          .dv-card p,
          .dv-card-actions {
            display: none;
          }

          .dv-card-play {
            right: 6px;
            bottom: 6px;
            font-size: 12px;
          }

          .dv-detail-header {
            grid-template-columns: minmax(0, 1fr);
            gap: 17px;
            padding: 13px;
          }

          .dv-detail-cover {
            width: min(100%, 260px);
            margin: 0 auto;
          }

          .dv-detail-info h1 {
            font-size: 26px;
          }

          .dv-episode {
            gap: 10px;
            padding: 10px;
          }

          .dv-profile-hero {
            padding: 17px;
            gap: 12px;
          }

          .dv-profile-avatar {
            width: 57px;
            height: 57px;
            font-size: 25px;
          }

          .dv-profile-stats {
            gap: 10px;
          }

          .dv-profile-stat {
            padding: 14px;
          }

          .dv-profile-stat strong {
            font-size: 23px;
          }

          .dv-profile-panel {
            padding: 15px;
          }

          .dv-bottom-nav {
            position: fixed;
            right: 0;
            bottom: 0;
            left: 0;
            z-index: 90;
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 0;
            padding: 6px 5px calc(6px + env(safe-area-inset-bottom));
            border-top: 1px solid rgba(255,255,255,.1);
            background: rgba(0,0,0,.97);
            backdrop-filter: blur(18px);
          }

          .dv-bottom-tab {
            display: flex;
            min-width: 0;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 4px;
            padding: 5px 1px;
            border: 0;
            border-radius: 8px;
            color: #c5c5c5;
            background: transparent;
          }

          .dv-bottom-tab.active {
            color: white;
          }

          .dv-bottom-icon {
            font-size: 25px;
            line-height: 1;
          }

          .dv-bottom-label {
            font-size: 10px;
            line-height: 1.2;
          }

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

        @media (min-width: 761px) {
          .dv-bottom-nav {
            display: flex;
            justify-content: center;
            gap: 10px;
            padding: 14px;
            border-top: 1px solid #222;
            background: #080808;
          }

          .dv-bottom-tab {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 17px;
            border: 1px solid transparent;
            border-radius: 9px;
            color: #aaa;
            background: transparent;
          }

          .dv-bottom-tab.active {
            color: white;
            border-color: #333;
            background: #171717;
          }

          .dv-bottom-icon {
            font-size: 19px;
          }

          .dv-bottom-label {
            font-size: 12px;
          }
        }

        @media (max-width: 360px) {
          .dv-grid {
            gap: 10px 7px;
          }

          .dv-card h3 {
            font-size: 11px;
          }

          .dv-card-category {
            font-size: 9px;
          }

          .dv-bottom-label {
            font-size: 9px;
          }

          .dv-top-nav {
            gap: 19px;
          }
        }

        @media (max-height: 520px) {
          .dv-player-overlay {
            align-items: flex-start;
          }

          .dv-player-modal {
            margin-block: 4px;
            max-height: none;
          }

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
          <span aria-hidden="true">⌕</span>

          <input
            type="search"
            placeholder="Buscar histórias..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);

              if (
                page === "inicio" ||
                page === "perfil"
              ) {
                setPage("inicio");
                setTopTab("descobrir");
              }
            }}
          />
        </label>
      </header>

      {/* ABAS SUPERIORES */}
      <nav
        className="dv-top-nav"
        aria-label="Descoberta do catálogo"
      >
        {TOP_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`dv-top-tab ${
              topTab === tab.key ? "active" : ""
            }`}
            onClick={() => goToTopTab(tab.key)}
            aria-current={
              topTab === tab.key ? "page" : undefined
            }
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* AVISO DE DESENVOLVIMENTO — MANTIDO INTENCIONALMENTE */}
      <aside
        className="dv-development-notice"
        role="status"
        aria-label="Aviso de desenvolvimento"
      >
        <div
          className="dv-development-icon"
          aria-hidden="true"
        >
          🚧
        </div>

        <div className="dv-development-content">
          <h2>
            O DRAMOVIX AINDA ESTÁ EM DESENVOLVIMENTO
          </h2>

          <p>
            Estamos preparando muitas novidades para você!
            Algumas séries ainda não possuem episódios
            disponíveis, e outras ainda não chegaram ao
            catálogo.
            <strong>
              {" "}Em breve teremos novas histórias e mais
              episódios.
            </strong>
            {" "}Obrigado pela paciência e por fazer parte
            dessa história! ❤️
          </p>
        </div>
      </aside>

      <main className="dv-main">
        {/* DETALHES DA SÉRIE */}
        {page === "detalhes" && selectedSeries && (
          <section className="dv-detail">
            <button
              className="dv-back"
              onClick={() => goToPage("inicio")}
            >
              ← Voltar ao catálogo
            </button>

            <div className="dv-detail-header">
              <img
                className="dv-detail-cover"
                src={
                  selectedSeries.image || DEFAULT_COVER
                }
                alt={selectedSeries.title}
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = DEFAULT_COVER;
                }}
              />

              <div className="dv-detail-info">
                <span className="dv-eyebrow">
                  {selectedSeries.category ||
                    "MINISSÉRIE"}
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
                      (
                        (selectedSeries.description || "")
                          .length > 180
                          ? "..."
                          : ""
                      )}
                </p>

                {(selectedSeries.description || "")
                  .length > 180 && (
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
                      episodesLoading ||
                      !episodes.length
                    }
                  >
                    ▶ Assistir primeiro episódio
                  </button>

                  <button
                    className="dv-description-toggle"
                    onClick={() =>
                      toggleFavorite(selectedSeries)
                    }
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
                    {episodes.length === 1 ? "" : "s"}
                    {" "}disponível
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
                      onClick={() =>
                        openEpisode(episode)
                      }
                    >
                      <span className="dv-episode-number">
                        {episode.episode_number ||
                          index + 1}
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

                      <span className="dv-episode-play">
                        ▶
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="dv-empty">
                  <h3>Esta história está chegando!</h3>

                  <p>
                    Esta série ainda não possui episódios
                    disponíveis. Estamos trabalhando para
                    trazer novidades ao DRAMOVIX. Volte em
                    breve para conferir as atualizações! ❤️
                  </p>
                </div>
              )}
            </section>
          </section>
        )}

        {/* INÍCIO / DESCOBRIR */}
        {page === "inicio" &&
          topTab === "descobrir" && (
            <>
              <section className="dv-hero">
                <div className="dv-hero-content">
                  <span className="dv-eyebrow">
                    ✦ DRAMOVIX+ ORIGINAL
                  </span>

                  <h1>
                    Sempre tem uma nova história.
                  </h1>

                  <p>
                    Romance, vingança, suspense e histórias
                    que prendem você do primeiro ao último
                    episódio.
                  </p>

                  <button
                    className="dv-button-primary"
                    onClick={() =>
                      goToTopTab("categorias")
                    }
                  >
                    Explorar catálogo →
                  </button>
                </div>
              </section>

              <section className="dv-section">
                <div className="dv-section-heading">
                  <div>
                    <h2>Escolha seu clima</h2>
                    <p>
                      Histórias para cada momento.
                    </p>
                  </div>

                  <button
                    className="dv-description-toggle"
                    onClick={() =>
                      goToTopTab("categorias")
                    }
                  >
                    Ver todas →
                  </button>
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
                        goToTopTab("categorias");
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
                    <p>
                      Descubra sua próxima história favorita.
                    </p>
                  </div>

                  <button
                    className="dv-description-toggle"
                    onClick={() =>
                      goToTopTab("categorias")
                    }
                  >
                    Ver catálogo →
                  </button>
                </div>

                {renderGrid(filteredSeries.slice(0, 12))}
              </section>

              <section className="dv-section">
                <div className="dv-section-heading">
                  <div>
                    <h2>Canais ao vivo</h2>
                    <p>
                      Transmissões disponíveis em Categorias.
                    </p>
                  </div>

                  <button
                    className="dv-description-toggle"
                    onClick={() =>
                      goToTopTab("categorias")
                    }
                  >
                    Ver opções →
                  </button>
                </div>

                {liveChannelsLoading ? (
                  <p className="dv-message">
                    Carregando canais ao vivo...
                  </p>
                ) : (
                  renderGrid(liveItems.slice(0, 3), "live")
                )}
              </section>

              {movies.length > 0 && (
                <section className="dv-section">
                  <div className="dv-section-heading">
                    <div>
                      <h2>Filmes para você</h2>
                      <p>
                        Escolha e comece a assistir.
                      </p>
                    </div>

                    <button
                      className="dv-description-toggle"
                      onClick={() =>
                        goToTopTab("categorias")
                      }
                    >
                      Ver filmes →
                    </button>
                  </div>

                  {renderGrid(
                    filteredMovies.slice(0, 6),
                    "movie"
                  )}
                </section>
              )}
            </>
          )}

        {/* ABA NOVO */}
        {page === "inicio" && topTab === "novo" && (
          <section className="dv-section">
            <div className="dv-section-heading">
              <div>
                <h2>Novo</h2>
                <p>
                  As histórias adicionadas mais recentemente.
                </p>
              </div>
            </div>

            {renderGrid(newSeries)}
          </section>
        )}

        {/* ABA RANKINGS */}
        {page === "inicio" &&
          topTab === "rankings" && (
            <section className="dv-section">
              <div className="dv-section-heading">
                <div>
                  <h2>Rankings</h2>
                  <p>
                    Descubra as histórias em destaque.
                  </p>
                </div>
              </div>

              {renderGrid(rankingSeries)}
            </section>
          )}

        {/* ABA CATEGORIAS */}
        {page === "inicio" &&
          topTab === "categorias" && (
            <>
              <section className="dv-section">
                <div className="dv-section-heading">
                  <div>
                    <h2>Categorias</h2>
                    <p>
                      Escolha o que você quer assistir.
                    </p>
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

              <section className="dv-section">
                <div className="dv-section-heading">
                  <div>
                    <h2>Ao vivo</h2>
                    <p>
                      Canais e transmissões disponíveis.
                    </p>
                  </div>
                </div>

                {liveChannelsLoading ? (
                  <p className="dv-message">
                    Carregando canais ao vivo...
                  </p>
                ) : (
                  renderGrid(liveItems, "live")
                )}
              </section>

              <section className="dv-section">
                <div className="dv-section-heading">
                  <div>
                    <h2>Filmes</h2>
                    <p>
                      Filmes disponíveis no catálogo.
                    </p>
                  </div>
                </div>

                {renderGrid(filteredMovies, "movie")}
              </section>
            </>
          )}

        {/* PARA VOCÊ */}
        {page === "para-voce" && (
          <>
            <section className="dv-section">
              <div className="dv-section-heading">
                <div>
                  <h2>Para Você</h2>
                  <p>
                    Histórias para descobrir e maratonar.
                  </p>
                </div>
              </div>

              {renderGrid(filteredSeries)}
            </section>

            {movies.length > 0 && (
              <section className="dv-section">
                <div className="dv-section-heading">
                  <div>
                    <h2>Filmes recomendados</h2>
                  </div>
                </div>

                {renderGrid(filteredMovies, "movie")}
              </section>
            )}
          </>
        )}

        {/* BENEFÍCIOS */}
        {page === "beneficios" && (
          <section className="dv-section">
            <div className="dv-section-heading">
              <div>
                <h2>Benefícios</h2>
                <p>
                  Novidades do DRAMOVIX.
                </p>
              </div>
            </div>

            <div className="dv-benefits-panel">
              <h2>🎁 Novidades chegando!</h2>

              <p>
                Estamos preparando novidades para melhorar
                sua experiência no DRAMOVIX.
              </p>

              <p>
                Esta área ainda está em desenvolvimento.
                Novos recursos poderão aparecer aqui nas
                próximas atualizações.
              </p>
            </div>
          </section>
        )}

        {/* FAVORITOS */}
        {page === "favoritos" && (
          <>
            <section className="dv-section">
              <div className="dv-section-heading">
                <div>
                  <h2>Meus favoritos</h2>
                  <p>
                    Suas histórias salvas neste dispositivo.
                  </p>
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

                {renderGrid(
                  favoriteMovies,
                  "movie"
                )}
              </section>
            )}
          </>
        )}

        {/* PERFIL */}
        {page === "perfil" && (
          <section className="dv-profile">
            <div className="dv-profile-hero">
              <div
                className="dv-profile-avatar"
                aria-hidden="true"
              >
                ♙
              </div>

              <div>
                <span className="dv-eyebrow">
                  SUA EXPERIÊNCIA
                </span>

                <h1>Meu perfil</h1>

                <p>
                  Seu espaço no DRAMOVIX. A personalização
                  de conta estará disponível em uma próxima
                  atualização.
                </p>
              </div>
            </div>

            <div className="dv-profile-stats">
              <div className="dv-profile-stat">
                <strong>
                  {favoriteSeries.length}
                </strong>
                <span>Minisséries favoritas</span>
              </div>

              <div className="dv-profile-stat">
                <strong>
                  {favoriteMovies.length}
                </strong>
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
                onClick={() =>
                  goToTopTab("categorias")
                }
              >
                <span>▤ Explorar categorias</span>
                <span>›</span>
              </button>
            </div>

            <div className="dv-profile-panel">
              <h2>Sobre o DRAMOVIX</h2>

              <p>
                O DRAMOVIX ainda está em desenvolvimento.
                Novos recursos poderão ser adicionados
                futuramente.
              </p>

              <p>
                Seus favoritos atuais ficam salvos neste
                dispositivo. Esta tela ainda não representa
                uma conta com login.
              </p>
            </div>
          </section>
        )}
      </main>

      <footer className="dv-footer">
        DRAMOVIX+ · Sempre tem uma nova história.

        <p>
          Plataforma em desenvolvimento. Novidades chegando
          em breve! ❤️
        </p>
      </footer>

      {/* MENU INFERIOR */}
      <nav
        className="dv-bottom-nav"
        aria-label="Menu inferior"
      >
        {BOTTOM_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`dv-bottom-tab ${
              page === tab.key ||
              (tab.key === "inicio" &&
                page === "inicio")
                ? "active"
                : ""
            }`}
            onClick={() => {
              if (tab.key === "inicio") {
                goToPage("inicio");
                setTopTab("descobrir");
              } else {
                goToPage(tab.key);
              }
            }}
            aria-label={tab.label}
            aria-current={
              page === tab.key ? "page" : undefined
            }
          >
            <span
              className="dv-bottom-icon"
              aria-hidden="true"
            >
              {tab.key === "favoritos" &&
              favoriteCount > 0
                ? "♥"
                : tab.icon}
            </span>

            <span className="dv-bottom-label">
              {tab.key === "favoritos" &&
              favoriteCount > 0
                ? `Favoritos (${favoriteCount})`
                : tab.label}
            </span>
          </button>
        ))}
      </nav>

      {/* PLAYER */}
      {playerOpen && (
        <div
          className="dv-player-overlay"
          onClick={(event) => {
            if (
              event.target === event.currentTarget
            ) {
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
                      : selectedSeries?.title ||
                        "DRAMOVIX+"}
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
                key={
                  selectedEpisode?.id ||
                  "dramovix-video"
                }
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
                          episode.id ===
                          selectedEpisode?.id
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
