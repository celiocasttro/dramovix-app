import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "./supabase";
import Hls from "hls.js";
import "./App.css";

const PLAYLISTS = {
  br: {
    label: "Brasil",
    url: "https://iptv-org.github.io/iptv/countries/br.m3u",
  },
  world: {
    label: "Internacional",
    url: "https://iptv-org.github.io/iptv/index.m3u",
  },
  categories: {
    label: "Categorias",
    url: "https://iptv-org.github.io/iptv/index.category.m3u",
  },
  languages: {
    label: "Idiomas",
    url: "https://iptv-org.github.io/iptv/index.language.m3u",
  },
};

const DEFAULT_SERIES_COVER =
  "https://placehold.co/600x800/171721/ffffff?text=Dramovix";

const DEFAULT_MOVIE_COVER =
  "https://placehold.co/600x800/171721/ffffff?text=Filme";

const DEFAULT_CHANNEL_LOGO =
  "https://placehold.co/100x100/171721/ffffff?text=TV";

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getSeriesCover(series) {
  const title = normalizeText(series?.title || "");

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
    series?.image ||
    series?.poster_url ||
    DEFAULT_SERIES_COVER
  );
}

function parseM3U(text) {
  const lines = text.split(/\r?\n/);
  const result = [];
  let info = "";

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) continue;

    if (line.startsWith("#EXTINF:")) {
      info = line;
      continue;
    }

    if (line.startsWith("#")) continue;

    if (!/^https?:\/\//i.test(line)) {
      info = "";
      continue;
    }

    const nameMatch = info.match(/,(.*)$/);
    const logoMatch = info.match(/tvg-logo="([^"]*)"/i);
    const groupMatch = info.match(/group-title="([^"]*)"/i);
    const idMatch = info.match(/tvg-id="([^"]*)"/i);

    const name = nameMatch?.[1]?.trim() || "Canal sem nome";

    result.push({
      id: `playlist-${result.length}-${line}`,
      name,
      title: name,
      logo: logoMatch?.[1] || "",
      category: groupMatch?.[1] || "Outros",
      tvg_id: idMatch?.[1] || "",
      stream_url: line,
      url: line,
      source: "playlist",
    });

    info = "";
  }

  return result;
}

function normalizeEpisodeTitle(episode, index) {
  const number =
    episode.episode_number ||
    episode.episode ||
    index + 1;

  const title = String(episode.title || "")
    .replace(/^epis[oó]dio\s*\d+\s*[-:.–—]?\s*/i, "")
    .trim();

  return {
    number,
    title,
    displayTitle: title
      ? `Episódio ${number} — ${title}`
      : `Episódio ${number}`,
  };
}

function detectHls(url) {
  try {
    const parsedUrl = new URL(url, window.location.href);

    return (
      /\.m3u8$/i.test(parsedUrl.pathname) ||
      /[?&](format|type)=m3u8(?:&|$)/i.test(
        parsedUrl.search
      )
    );
  } catch {
    return /\.m3u8(?:$|[?#])/i.test(url);
  }
}

export default function App() {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  const [section, setSection] = useState("Início");
  const [series, setSeries] = useState([]);
  const [movies, setMovies] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [dbChannels, setDbChannels] = useState([]);
  const [playlistChannels, setPlaylistChannels] = useState([]);

  const [selectedSeries, setSelectedSeries] = useState(null);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [currentVideo, setCurrentVideo] = useState(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");
  const [channelCategory, setChannelCategory] = useState("Todas");
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

  const [loading, setLoading] = useState(true);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [error, setError] = useState("");

  const [playerOpen, setPlayerOpen] = useState(false);
  const [playerError, setPlayerError] = useState("");

  // Carrega o catálogo do Supabase.
  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      setLoading(true);
      setError("");

      try {
        const [
          { data: seriesData, error: seriesError },
          { data: moviesData, error: moviesError },
          { data: channelsData, error: channelsError },
        ] = await Promise.all([
          supabase.from("series").select("*"),
          supabase.from("movies").select("*"),
          supabase.from("channels").select("*"),
        ]);

        if (cancelled) return;

        if (seriesError) throw seriesError;

        setSeries(seriesData || []);

        if (moviesError) {
          console.warn(
            "Não foi possível carregar os filmes:",
            moviesError
          );
        }

        if (channelsError) {
          console.warn(
            "Não foi possível carregar os canais do Supabase:",
            channelsError
          );
        }

        setMovies(moviesData || []);

        setDbChannels(
          (channelsData || []).map((channel) => ({
            ...channel,
            name: channel.name || channel.title || "Canal",
            logo: channel.logo || channel.image || "",
            stream_url:
              channel.stream_url ||
              channel.video_url ||
              channel.url ||
              "",
            category: channel.category || "Outros",
            source: "supabase",
          }))
        );
      } catch (err) {
        if (cancelled) return;

        console.error("Erro ao carregar catálogo:", err);

        setSeries([]);
        setMovies([]);
        setDbChannels([]);

        setError(
          "Não foi possível carregar o catálogo do Supabase. Verifique a conexão e as tabelas."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  // Salva os favoritos no navegador.
  useEffect(() => {
    try {
      localStorage.setItem(
        "dramovix-favorites",
        JSON.stringify(favorites)
      );
    } catch (err) {
      console.warn("Não foi possível salvar os favoritos:", err);
    }
  }, [favorites]);

  // Carrega os episódios da minissérie selecionada.
  useEffect(() => {
    let cancelled = false;

    async function loadEpisodes() {
      if (!selectedSeries) {
        setEpisodes([]);
        setEpisodesLoading(false);
        return;
      }

      setEpisodes([]);
      setEpisodesLoading(true);

      try {
        const { data, error: episodesError } = await supabase
          .from("episodes")
          .select("*")
          .eq("series_id", selectedSeries.id)
          .order("episode_number", { ascending: true });

        if (episodesError) throw episodesError;

        if (!cancelled) {
          setEpisodes(data || []);
        }
      } catch (err) {
        console.error("Erro ao carregar episódios:", err);

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

  // Carrega a playlist de canais.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadPlaylist() {
      const playlist = PLAYLISTS[channelSource];

      if (!playlist) {
        setPlaylistChannels([]);
        setPlaylistLoading(false);
        return;
      }

      setPlaylistLoading(true);

      try {
        const response = await fetch(playlist.url, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Falha ao carregar playlist: ${response.status}`
          );
        }

        const text = await response.text();
        const parsed = parseM3U(text);

        if (!cancelled) {
          setPlaylistChannels(
            parsed.map((channel) => ({
              ...channel,
              country:
                channelSource === "br"
                  ? "Brasil"
                  : "Internacional",
            }))
          );
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Erro ao importar playlist:", err);
        }

        if (!cancelled) {
          setPlaylistChannels([]);
        }
      } finally {
        if (!cancelled) {
          setPlaylistLoading(false);
        }
      }
    }

    loadPlaylist();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [channelSource]);

  // Abre o player com o endereço do conteúdo.
  function openPlayer(item, type = "movie") {
    const videoUrl = String(
      item.video_url ||
      item.stream_url ||
      item.url ||
      ""
    ).trim();

    setPlayerError("");

    setCurrentVideo({
      ...item,
      url: videoUrl,
      type,
      name: item.name || item.title || "Dramovix",
    });

    setPlayerOpen(true);

    if (!videoUrl) {
      setPlayerError(
        "Este conteúdo ainda não possui um link de vídeo cadastrado."
      );
    }
  }

  // Fecha o player e limpa a mídia.
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

  // Player para HLS, MP4 e outros formatos suportados pelo navegador.
  useEffect(() => {
    const video = videoRef.current;

    if (!playerOpen || !currentVideo || !video) return;

    const url = String(
      currentVideo.video_url ||
      currentVideo.stream_url ||
      currentVideo.url ||
      ""
    ).trim();

    let hls = null;
    let cancelled = false;
    let fatalErrorShown = false;

    const showError = (message) => {
      if (!cancelled) {
        setPlayerError(message);
      }
    };

    const handleVideoError = () => {
      if (cancelled || fatalErrorShown) return;

      const code = video.error?.code;

      const messages = {
        1: "A reprodução foi interrompida.",
        2: "Erro de rede ao carregar o vídeo. Verifique o endereço e o servidor.",
        3: "O navegador não conseguiu decodificar este vídeo.",
        4: "Formato incompatível ou link que não fornece um vídeo diretamente.",
      };

      showError(
        messages[code] ||
          "Não foi possível reproduzir o vídeo. Verifique o link."
      );

      console.error("Erro no elemento de vídeo:", {
        code,
        message: video.error?.message,
        url,
      });
    };

    const handleLoadedData = () => {
      if (!cancelled) {
        setPlayerError("");
      }
    };

    const handleCanPlay = () => {
      if (!cancelled) {
        setPlayerError("");
      }
    };

    // Limpa a mídia anterior.
    video.pause();
    video.removeAttribute("src");
    video.load();

    if (!url) {
      showError(
        "Este episódio não possui um link de vídeo cadastrado."
      );

      return () => {
        cancelled = true;
      };
    }

    setPlayerError("");

    video.addEventListener("error", handleVideoError);
    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("canplay", handleCanPlay);

    const isHls = detectHls(url);

    if (isHls && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
      });

      hlsRef.current = hls;

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (cancelled) return;

        console.error("Erro HLS:", {
          type: data.type,
          details: data.details,
          fatal: data.fatal,
          responseCode: data.response?.code,
          url,
        });

        if (!data.fatal) return;

        fatalErrorShown = true;

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          showError(
            "Falha ao carregar a playlist ou os segmentos do vídeo. O servidor pode estar indisponível, bloquear acesso externo ou exigir autorização."
          );

          hls.stopLoad();
        } else if (
          data.type === Hls.ErrorTypes.MEDIA_ERROR
        ) {
          showError(
            "Ocorreu um erro ao processar a mídia. Tentando recuperar o vídeo..."
          );

          fatalErrorShown = false;
          hls.recoverMediaError();
        } else {
          showError(
            "O HLS não conseguiu reproduzir este episódio. Verifique o endereço e o formato do vídeo."
          );

          hls.destroy();

          if (hlsRef.current === hls) {
            hlsRef.current = null;
          }

          hls = null;
        }
      });

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (cancelled) return;

        fatalErrorShown = false;
        setPlayerError("");

        video.play().catch((err) => {
          if (
            !cancelled &&
            err?.name !== "NotAllowedError" &&
            err?.name !== "AbortError"
          ) {
            console.warn(
              "Não foi possível iniciar a reprodução:",
              err
            );
          }
        });
      });

      hls.loadSource(url);
      hls.attachMedia(video);
    } else if (
      isHls &&
      video.canPlayType("application/vnd.apple.mpegurl")
    ) {
      // HLS nativo, quando suportado pelo navegador.
      video.src = url;
      video.load();
    } else if (isHls) {
      showError(
        "Este navegador não oferece suporte à reprodução HLS deste endereço."
      );
    } else {
      // Vídeo direto, como MP4.
      video.src = url;
      video.load();
    }

    return () => {
      cancelled = true;

      video.pause();

      video.removeEventListener("error", handleVideoError);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("canplay", handleCanPlay);

      if (hls) {
        hls.destroy();

        if (hlsRef.current === hls) {
          hlsRef.current = null;
        }

        hls = null;
      }

      video.removeAttribute("src");
      video.load();
    };
  }, [playerOpen, currentVideo]);

  function toggleFavorite(item) {
    const id = String(item.id);

    setFavorites((previous) =>
      previous.includes(id)
        ? previous.filter((favoriteId) => favoriteId !== id)
        : [...previous, id]
    );
  }

  function isFavorite(item) {
    return favorites.includes(String(item.id));
  }

  function goHome() {
    setSection("Início");
    setSelectedSeries(null);
    setSelectedEpisode(null);
    setCategory("Todas");
    setSearch("");
  }

  const allChannels = useMemo(() => {
    const combined = [
      ...dbChannels,
      ...playlistChannels,
    ];

    const seen = new Set();

    return combined.filter((channel) => {
      const url =
        channel.stream_url ||
        channel.video_url ||
        channel.url;

      if (!url || seen.has(url)) return false;

      seen.add(url);
      return true;
    });
  }, [dbChannels, playlistChannels]);

  const seriesCategories = useMemo(() => {
    const values = series
      .map((item) => item.category)
      .filter(Boolean);

    return ["Todas", ...new Set(values)];
  }, [series]);

  const channelCategories = useMemo(() => {
    const values = allChannels
      .map((channel) => channel.category)
      .filter(Boolean);

    return ["Todas", ...new Set(values)];
  }, [allChannels]);

  const filteredSeries = useMemo(() => {
    return series.filter((item) => {
      const text = `${item.title || ""} ${
        item.description || ""
      } ${item.category || ""}`.toLowerCase();

      const matchesSearch = text.includes(
        search.toLowerCase()
      );

      const matchesCategory =
        category === "Todas" ||
        item.category === category;

      const matchesFavorite =
        section !== "Favoritos" ||
        isFavorite(item);

      return (
        matchesSearch &&
        matchesCategory &&
        matchesFavorite
      );
    });
  }, [series, search, category, section, favorites]);

  const filteredMovies = useMemo(() => {
    return movies.filter((item) => {
      const text = `${item.title || ""} ${
        item.description || ""
      } ${item.category || ""}`.toLowerCase();

      return (
        text.includes(search.toLowerCase()) &&
        (section !== "Favoritos" || isFavorite(item))
      );
    });
  }, [movies, search, section, favorites]);

  const filteredChannels = useMemo(() => {
    return allChannels.filter((channel) => {
      const text = `${channel.name || ""} ${
        channel.category || ""
      }`.toLowerCase();

      const matchesSearch = text.includes(
        search.toLowerCase()
      );

      const matchesCategory =
        channelCategory === "Todas" ||
        channel.category === channelCategory;

      return matchesSearch && matchesCategory;
    });
  }, [allChannels, search, channelCategory]);

  const styles = `
    * {
      box-sizing: border-box;
    }

    html {
      width: 100%;
      min-height: 100%;
      overflow-x: hidden;
    }

    body {
      margin: 0;
      width: 100%;
      min-width: 0;
      overflow-x: hidden;
      background: #080910;
      color: #f8f8fc;
      font-family: Arial, Helvetica, sans-serif;
    }

    button, input, select {
      font: inherit;
    }

    button {
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }

    img, video {
      max-width: 100%;
    }

    .dv-app {
      min-height: 100vh;
      min-height: 100dvh;
      width: 100%;
      overflow-x: clip;
      background:
        radial-gradient(ellipse at top right, #27102c 0, transparent 36%),
        #080910;
      color: #f8f8fc;
    }

    .dv-header {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      width: 100%;
      padding: 14px 5%;
      background: rgba(8, 9, 16, .97);
      border-bottom: 1px solid #252530;
      backdrop-filter: blur(16px);
    }

    .dv-logo {
      flex-shrink: 0;
      font-size: 25px;
      font-weight: 900;
      letter-spacing: -1px;
      color: #fff;
      cursor: pointer;
      white-space: nowrap;
    }

    .dv-logo span {
      color: #e34bff;
    }

    .dv-nav {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      min-width: 0;
    }

    .dv-nav button {
      color: #b9b9c8;
      background: transparent;
      border: 0;
      padding: 10px 11px;
      border-radius: 9px;
      white-space: nowrap;
      font-size: 14px;
    }

    .dv-nav button.active,
    .dv-nav button:hover {
      color: #fff;
      background: #292033;
    }

    .dv-search {
      width: 200px;
      min-width: 0;
      padding: 11px 13px;
      color: white;
      background: #171720;
      border: 1px solid #30303d;
      border-radius: 12px;
      outline: none;
    }

    .dv-search:focus {
      border-color: #bd4bd9;
    }

    .dv-main {
      width: 100%;
      max-width: 1500px;
      margin: auto;
      padding: 26px 5% 70px;
    }

    .dv-hero {
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: flex-end;
      min-height: 320px;
      padding: 35px;
      border-radius: 22px;
      background:
        linear-gradient(90deg, rgba(8,8,15,.98), rgba(8,8,15,.62), rgba(8,8,15,.08)),
        url("https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1600&q=80")
        center/cover;
      border: 1px solid #302437;
      margin-bottom: 35px;
    }

    .dv-hero-content {
      max-width: 600px;
    }

    .dv-eyebrow {
      color: #f08cff;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 2px;
      text-transform: uppercase;
    }

    .dv-hero h1 {
      margin: 12px 0;
      font-size: clamp(30px, 5vw, 52px);
      line-height: 1.04;
    }

    .dv-hero p {
      max-width: 470px;
      color: #d0cfda;
      line-height: 1.6;
    }

    .dv-primary {
      background: linear-gradient(110deg, #e34bff, #8c45ff);
      color: white;
      border: 0;
      border-radius: 11px;
      padding: 12px 20px;
      font-weight: 800;
    }

    .dv-secondary {
      background: #24222e;
      color: white;
      border: 1px solid #3a3545;
      border-radius: 11px;
      padding: 11px 16px;
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
      color: #aaa9b9;
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
      background: #14141d;
      border: 1px solid #292936;
      border-radius: 15px;
      transition: transform .2s, border-color .2s;
    }

    .dv-card:hover {
      transform: translateY(-4px);
      border-color: #a84ac4;
    }

    .dv-card-image {
      position: relative;
      aspect-ratio: 3 / 4;
      background: #22222c;
      overflow: hidden;
    }

    .dv-card-image img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
    }

    .dv-card-body {
      padding: 13px;
    }

    .dv-card h3 {
      margin: 0 0 8px;
      font-size: 15px;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    .dv-card p {
      margin: 0;
      color: #aaa9b9;
      font-size: 12px;
      line-height: 1.5;
    }

    .dv-card-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
    }

    .dv-card-actions button {
      flex: 1;
      min-width: 0;
      border: 0;
      border-radius: 8px;
      padding: 9px 6px;
      color: white;
      background: #31203c;
      font-size: 12px;
    }

    .dv-card-actions button:last-child {
      flex: 0 0 38px;
      background: #24242f;
      font-size: 16px;
    }

    .dv-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 18px 0;
    }

    .dv-filter {
      color: #c5c4d0;
      background: #191923;
      border: 1px solid #30303c;
      border-radius: 999px;
      padding: 9px 14px;
    }

    .dv-filter.active {
      background: #5d2670;
      border-color: #d052f5;
      color: white;
    }

    .dv-select {
      background: #191923;
      color: white;
      border: 1px solid #383846;
      border-radius: 10px;
      padding: 11px;
      max-width: 100%;
    }

    .dv-back {
      margin-bottom: 22px;
    }

    .dv-detail {
      display: grid;
      grid-template-columns: minmax(180px, 300px) minmax(0, 1fr);
      gap: 30px;
      align-items: start;
    }

    .dv-detail-poster {
      width: 100%;
      border-radius: 17px;
      object-fit: cover;
      max-height: 420px;
      background: #1d1d29;
    }

    .dv-detail h1 {
      margin: 0 0 12px;
      font-size: clamp(28px, 4vw, 42px);
      overflow-wrap: anywhere;
    }

    .dv-detail p {
      color: #c0bfce;
      line-height: 1.7;
    }

    .dv-episodes {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
      gap: 12px;
      margin-top: 20px;
    }

    .dv-episode {
      display: flex;
      align-items: center;
      gap: 13px;
      width: 100%;
      min-width: 0;
      padding: 14px;
      text-align: left;
      color: white;
      background: #171721;
      border: 1px solid #30303d;
      border-radius: 13px;
      transition: border-color .2s, background .2s;
    }

    .dv-episode:hover {
      background: #24172b;
      border-color: #b64bd1;
    }

    .dv-episode-number {
      display: grid;
      place-items: center;
      flex: 0 0 42px;
      height: 42px;
      background: #382044;
      color: #f0a5ff;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 900;
    }

    .dv-episode-info {
      display: flex;
      flex: 1;
      min-width: 0;
      flex-direction: column;
      gap: 6px;
    }

    .dv-episode-info strong {
      font-size: 13px;
      line-height: 1.4;
      overflow-wrap: anywhere;
    }

    .dv-episode-info small {
      color: #aaa9b9;
      font-size: 11px;
    }

    .dv-episode-play {
      flex-shrink: 0;
      color: #e87bff;
      font-size: 18px;
    }

    .dv-channel-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(155px, 1fr));
      gap: 13px;
    }

    .dv-channel {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      min-height: 150px;
      min-width: 0;
      padding: 18px 12px;
      color: white;
      background: #15151e;
      border: 1px solid #2b2b38;
      border-radius: 15px;
      text-align: center;
    }

    .dv-channel:hover {
      border-color: #bd4bd9;
      background: #21172a;
    }

    .dv-channel img {
      width: 65px;
      height: 65px;
      object-fit: contain;
    }

    .dv-channel-name {
      font-size: 13px;
      font-weight: 700;
      overflow-wrap: anywhere;
    }

    .dv-empty {
      padding: 35px 15px;
      text-align: center;
      color: #aaa9b9;
      background: #14141d;
      border: 1px dashed #363644;
      border-radius: 15px;
      line-height: 1.6;
    }

    .dv-notice {
      padding: 13px 15px;
      margin: 16px 0;
      background: #211a2b;
      color: #e2c9ee;
      border: 1px solid #50325e;
      border-radius: 11px;
      font-size: 13px;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }

    .dv-player-overlay {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: grid;
      place-items: center;
      padding: 18px;
      background: rgba(0,0,0,.92);
      backdrop-filter: blur(8px);
      overflow-y: auto;
      overscroll-behavior: contain;
    }

    .dv-player-modal {
      width: min(100%, 900px);
      max-height: 94dvh;
      overflow: auto;
      background: #101018;
      border: 1px solid #3b3044;
      border-radius: 17px;
      overscroll-behavior: contain;
    }

    .dv-player-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 17px;
    }

    .dv-player-top h3 {
      min-width: 0;
      margin: 0;
      font-size: 15px;
      line-height: 1.4;
      overflow-wrap: anywhere;
    }

    .dv-player-close {
      flex: 0 0 38px;
      width: 38px;
      height: 38px;
      color: white;
      background: #292532;
      border: 0;
      border-radius: 10px;
      font-size: 22px;
    }

    .dv-video-wrap {
      width: 100%;
      background: black;
      aspect-ratio: 16 / 9;
    }

    .dv-video {
      width: 100%;
      height: 100%;
      display: block;
      background: black;
      object-fit: contain;
    }

    .dv-player-modal.dv-player-vertical {
      width: min(92vw, 420px);
      max-height: 94dvh;
      overflow-y: auto;
    }

    .dv-player-vertical .dv-player-top {
      padding: 10px 12px;
    }

    .dv-player-vertical .dv-video-wrap {
      width: 100%;
      aspect-ratio: 9 / 16;
      max-height: calc(94dvh - 75px);
      overflow: hidden;
    }

    .dv-player-vertical .dv-video {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .dv-player-error {
      padding: 15px;
      color: #ffb9c2;
      font-size: 13px;
      line-height: 1.6;
      overflow-wrap: anywhere;
    }

    .dv-footer {
      padding: 25px 5%;
      border-top: 1px solid #282833;
      text-align: center;
      color: #777687;
      font-size: 12px;
    }

    /* Tablets e celulares. */
    @media (max-width: 900px) {
      .dv-header {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
        gap: 12px;
        padding: 12px 4%;
      }

      .dv-logo {
        font-size: 23px;
      }

      .dv-search {
        width: 100%;
        grid-column: 2;
        grid-row: 1;
      }

      /* Todas as opções aparecem sem rolagem horizontal. */
      .dv-nav {
        grid-column: 1 / -1;
        grid-row: 2;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 6px;
        width: 100%;
        overflow: visible;
      }

      .dv-nav button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        min-width: 0;
        min-height: 38px;
        padding: 9px 4px;
        white-space: normal;
        text-align: center;
        font-size: 12px;
        line-height: 1.25;
        overflow-wrap: anywhere;
      }

      .dv-main {
        padding: 20px 4% 45px;
      }

      .dv-detail {
        grid-template-columns: minmax(0, 240px) minmax(0, 1fr);
        gap: 22px;
      }
    }

    @media (max-width: 600px) {
      .dv-header {
        position: relative;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
        gap: 10px;
        padding: 12px 4%;
      }

      .dv-logo {
        font-size: clamp(19px, 5.2vw, 23px);
      }

      .dv-search {
        min-width: 0;
        padding: 10px;
        font-size: 12px;
      }

      .dv-nav {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 5px;
      }

      .dv-nav button {
        min-height: 36px;
        padding: 8px 3px;
        font-size: 11px;
        border-radius: 8px;
      }

      .dv-main {
        padding: 16px 4% 40px;
      }

      .dv-hero {
        min-height: 250px;
        padding: 20px;
        border-radius: 15px;
        background-position: center;
      }

      .dv-hero h1 {
        font-size: clamp(30px, 9vw, 42px);
      }

      .dv-hero p {
        font-size: 13px;
      }

      .dv-section-title {
        align-items: flex-start;
        margin: 23px 0 15px;
      }

      .dv-section-title h2 {
        font-size: 20px;
      }

      .dv-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 11px;
      }

      .dv-card {
        border-radius: 12px;
      }

      .dv-card-body {
        padding: 10px;
      }

      .dv-card h3 {
        font-size: 13px;
      }

      .dv-card p {
        font-size: 11px;
      }

      .dv-card-actions {
        gap: 5px;
      }

      .dv-card-actions button {
        padding: 9px 4px;
        font-size: 11px;
      }

      .dv-card-actions button:last-child {
        flex-basis: 32px;
      }

      .dv-detail {
        grid-template-columns: minmax(0, 1fr);
        gap: 16px;
      }

      .dv-detail-poster {
        width: min(65%, 230px);
        max-height: 320px;
        margin: 0 auto;
        display: block;
      }

      .dv-detail h1 {
        font-size: 27px;
      }

      .dv-detail p {
        font-size: 14px;
      }

      .dv-episodes {
        grid-template-columns: minmax(0, 1fr);
        gap: 10px;
      }

      .dv-episode {
        padding: 12px;
        gap: 10px;
      }

      .dv-channel-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .dv-channel {
        min-height: 130px;
        padding: 13px 8px;
      }

      .dv-filters {
        gap: 7px;
      }

      .dv-filter {
        padding: 8px 11px;
        font-size: 12px;
      }

      .dv-player-overlay {
        padding: 8px;
      }

      .dv-player-modal {
        width: 100%;
        max-height: 92dvh;
        border-radius: 12px;
      }

      .dv-player-top {
        padding: 10px;
      }

      .dv-player-top h3 {
        font-size: 13px;
      }

      .dv-player-modal.dv-player-vertical {
        width: min(94vw, 420px);
        max-height: 94dvh;
      }

      .dv-player-vertical .dv-video-wrap {
        max-height: calc(94dvh - 65px);
      }

      .dv-player-error {
        padding: 11px;
        font-size: 12px;
      }

      .dv-footer {
        padding: 22px 4%;
      }
    }

    @media (max-width: 350px) {
      .dv-logo {
        font-size: 18px;
      }

      .dv-nav button {
        font-size: 10px;
        padding: 7px 2px;
      }

      .dv-grid {
        gap: 8px;
      }

      .dv-card-body {
        padding: 8px;
      }

      .dv-card-actions button {
        font-size: 10px;
      }
    }
  `;

  return (
    <div className="dv-app">
      <style>{styles}</style>

      <header className="dv-header">
        <div className="dv-logo" onClick={goHome}>
          DRA<span>MOVIX</span>
        </div>

        <input
          className="dv-search"
          type="search"
          placeholder="Buscar conteúdo..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Buscar conteúdo"
        />

        <nav className="dv-nav">
          {[
            "Início",
            "Minisséries",
            "Filmes",
            "TV ao vivo",
            "Favoritos",
          ].map((item) => (
            <button
              key={item}
              className={section === item ? "active" : ""}
              onClick={() => {
                setSection(item);
                setSelectedSeries(null);
                setSelectedEpisode(null);
                setCategory("Todas");
              }}
            >
              {item}
            </button>
          ))}
        </nav>
      </header>

      <main className="dv-main">
        {error && <div className="dv-notice">{error}</div>}

        {selectedSeries ? (
          <>
            <button
              className="dv-secondary dv-back"
              onClick={() => {
                setSelectedSeries(null);
                setSelectedEpisode(null);
                setEpisodes([]);
              }}
            >
              ← Voltar ao catálogo
            </button>

            <section className="dv-detail">
              <img
                className="dv-detail-poster"
                src={getSeriesCover(selectedSeries)}
                alt={selectedSeries.title || "Minissérie"}
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = DEFAULT_SERIES_COVER;
                }}
              />

              <div>
                <span className="dv-eyebrow">
                  {selectedSeries.category || "Minissérie"}
                </span>

                <h1>{selectedSeries.title}</h1>

                <p>
                  {selectedSeries.description ||
                    "Confira os episódios disponíveis desta história."}
                </p>

                <div className="dv-card-actions">
                  <button
                    onClick={() => toggleFavorite(selectedSeries)}
                  >
                    {isFavorite(selectedSeries)
                      ? "♥ Remover dos favoritos"
                      : "♡ Adicionar aos favoritos"}
                  </button>
                </div>

                <div className="dv-section-title">
                  <h2>Episódios</h2>

                  <span className="dv-muted">
                    {episodes.length} episódio(s)
                  </span>
                </div>

                {episodesLoading ? (
                  <div className="dv-empty">
                    Carregando episódios...
                  </div>
                ) : episodes.length === 0 ? (
                  <div className="dv-empty">
                    Nenhum episódio cadastrado para esta minissérie.
                  </div>
                ) : (
                  <div className="dv-episodes">
                    {episodes.map((episode, index) => {
                      const {
                        number,
                        title,
                        displayTitle,
                      } = normalizeEpisodeTitle(episode, index);

                      return (
                        <button
                          key={episode.id || index}
                          className="dv-episode"
                          onClick={() => {
                            setSelectedEpisode(episode);

                            openPlayer(
                              {
                                ...episode,
                                name: displayTitle,
                                url:
                                  episode.video_url ||
                                  episode.stream_url ||
                                  episode.url ||
                                  "",
                              },
                              "episode"
                            );
                          }}
                        >
                          <span className="dv-episode-number">
                            {String(number).padStart(2, "0")}
                          </span>

                          <span className="dv-episode-info">
                            <strong>
                              {title || `Episódio ${number}`}
                            </strong>

                            <small>▶ Assistir episódio</small>
                          </span>

                          <span className="dv-episode-play">
                            ▶
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </>
        ) : section === "TV ao vivo" ? (
          <>
            <section className="dv-section-title">
              <div>
                <h2>TV ao vivo</h2>

                <p className="dv-muted">
                  Canais disponíveis nas fontes selecionadas.
                </p>
              </div>
            </section>

            <div className="dv-filters">
              {Object.entries(PLAYLISTS).map(
                ([key, playlist]) => (
                  <button
                    key={key}
                    className={`dv-filter ${
                      channelSource === key ? "active" : ""
                    }`}
                    onClick={() => {
                      setChannelSource(key);
                      setChannelCategory("Todas");
                    }}
                  >
                    {playlist.label}
                  </button>
                )
              )}
            </div>

            <div className="dv-filters">
              <select
                className="dv-select"
                value={channelCategory}
                onChange={(event) =>
                  setChannelCategory(event.target.value)
                }
              >
                {channelCategories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <span className="dv-muted">
                {playlistLoading
                  ? "Carregando canais..."
                  : `${filteredChannels.length} canal(is)`}
              </span>
            </div>

            {playlistLoading && (
              <div className="dv-notice">
                Importando canais da playlist...
              </div>
            )}

            {filteredChannels.length === 0 ? (
              <div className="dv-empty">
                Nenhum canal encontrado. Tente outra fonte ou categoria.
              </div>
            ) : (
              <div className="dv-channel-grid">
                {filteredChannels.map((channel, index) => (
                  <button
                    key={channel.id || channel.tvg_id || index}
                    className="dv-channel"
                    onClick={() =>
                      openPlayer(
                        {
                          ...channel,
                          name: channel.name,
                          url:
                            channel.stream_url ||
                            channel.video_url ||
                            channel.url,
                        },
                        "channel"
                      )
                    }
                  >
                    {channel.logo ? (
                      <img
                        src={channel.logo}
                        alt=""
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src =
                            DEFAULT_CHANNEL_LOGO;
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: 34 }}>📺</span>
                    )}

                    <span className="dv-channel-name">
                      {channel.name}
                    </span>

                    <span className="dv-muted">
                      {channel.category}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : section === "Filmes" ? (
          <>
            <div className="dv-section-title">
              <h2>Filmes</h2>

              <span className="dv-muted">
                {filteredMovies.length} título(s)
              </span>
            </div>

            {filteredMovies.length === 0 ? (
              <div className="dv-empty">
                Nenhum filme cadastrado no momento.
              </div>
            ) : (
              <div className="dv-grid">
                {filteredMovies.map((movie, index) => (
                  <article
                    className="dv-card"
                    key={movie.id || index}
                  >
                    <div className="dv-card-image">
                      <img
                        src={
                          movie.image ||
                          movie.poster_url ||
                          DEFAULT_MOVIE_COVER
                        }
                        alt={movie.title || "Filme"}
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = DEFAULT_MOVIE_COVER;
                        }}
                      />
                    </div>

                    <div className="dv-card-body">
                      <h3>{movie.title}</h3>

                      <p>{movie.category || "Filme"}</p>

                      <div className="dv-card-actions">
                        <button
                          onClick={() => openPlayer(movie, "movie")}
                        >
                          ▶ Assistir
                        </button>

                        <button
                          onClick={() => toggleFavorite(movie)}
                          aria-label="Favoritar filme"
                        >
                          {isFavorite(movie) ? "♥" : "♡"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {section === "Início" && (
              <section className="dv-hero">
                <div className="dv-hero-content">
                  <span className="dv-eyebrow">
                    Sua próxima história começa aqui
                  </span>

                  <h1>
                    Histórias que
                    <br />
                    prendem você.
                  </h1>

                  <p>
                    Descubra minisséries, romances, dramas e
                    novas histórias para assistir.
                  </p>

                  <button
                    className="dv-primary"
                    onClick={() => setSection("Minisséries")}
                  >
                    Explorar catálogo →
                  </button>
                </div>
              </section>
            )}

            <div className="dv-section-title">
              <h2>
                {section === "Favoritos"
                  ? "Meus favoritos"
                  : section === "Minisséries"
                    ? "Minisséries"
                    : "Escolha sua próxima história"}
              </h2>

              <span className="dv-muted">
                {filteredSeries.length} título(s)
              </span>
            </div>

            <div className="dv-filters">
              {seriesCategories.map((item) => (
                <button
                  key={item}
                  className={`dv-filter ${
                    category === item ? "active" : ""
                  }`}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="dv-empty">
                Carregando catálogo...
              </div>
            ) : filteredSeries.length === 0 ? (
              <div className="dv-empty">
                {section === "Favoritos"
                  ? "Você ainda não adicionou minisséries aos favoritos."
                  : "Nenhuma minissérie encontrada no catálogo."}
              </div>
            ) : (
              <div className="dv-grid">
                {filteredSeries.map((item, index) => (
                  <article
                    className="dv-card"
                    key={item.id || index}
                  >
                    <div
                      className="dv-card-image"
                      onClick={() => setSelectedSeries(item)}
                      style={{ cursor: "pointer" }}
                    >
                      <img
                        src={getSeriesCover(item)}
                        alt={item.title || "Minissérie"}
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = DEFAULT_SERIES_COVER;
                        }}
                      />
                    </div>

                    <div className="dv-card-body">
                      <h3>{item.title}</h3>

                      <p>{item.category || "Minissérie"}</p>

                      <div className="dv-card-actions">
                        <button
                          onClick={() => setSelectedSeries(item)}
                        >
                          ▶ Ver episódios
                        </button>

                        <button
                          onClick={() => toggleFavorite(item)}
                          aria-label="Favoritar minissérie"
                        >
                          {isFavorite(item) ? "♥" : "♡"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {section === "Início" && (
              <>
                <div className="dv-section-title">
                  <h2>Filmes</h2>

                  <button
                    className="dv-secondary"
                    onClick={() => setSection("Filmes")}
                  >
                    Ver todos →
                  </button>
                </div>

                {movies.length === 0 ? (
                  <div className="dv-empty">
                    Os filmes aparecerão aqui quando forem cadastrados
                    no Supabase.
                  </div>
                ) : (
                  <div className="dv-grid">
                    {movies.slice(0, 6).map((movie, index) => (
                      <article
                        className="dv-card"
                        key={movie.id || index}
                      >
                        <div className="dv-card-image">
                          <img
                            src={
                              movie.image ||
                              movie.poster_url ||
                              DEFAULT_MOVIE_COVER
                            }
                            alt={movie.title || "Filme"}
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.onerror = null;
                              event.currentTarget.src = DEFAULT_MOVIE_COVER;
                            }}
                          />
                        </div>

                        <div className="dv-card-body">
                          <h3>{movie.title}</h3>

                          <div className="dv-card-actions">
                            <button
                              onClick={() =>
                                openPlayer(movie, "movie")
                              }
                            >
                              ▶ Assistir
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      <footer className="dv-footer">
        Dramovix · Suas histórias, do seu jeito.
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
            className={`dv-player-modal ${
              currentVideo?.type === "episode"
                ? "dv-player-vertical"
                : ""
            }`}
          >
            <div className="dv-player-top">
              <h3>
                {currentVideo?.name ||
                  currentVideo?.title ||
                  "Dramovix"}
              </h3>

              <button
                className="dv-player-close"
                onClick={closePlayer}
                aria-label="Fechar player"
              >
                ×
              </button>
            </div>

            <div className="dv-video-wrap">
              <video
                key={currentVideo?.url || "empty-video"}
                ref={videoRef}
                className="dv-video"
                controls
                playsInline
                preload="metadata"
              />
            </div>

            {playerError && (
              <div className="dv-player-error" role="status">
                {playerError}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
