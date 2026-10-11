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

const DEMO_SERIES = [
  {
    id: "demo-1",
    title: "Contrato de Amor",
    category: "Romance",
    description:
      "Um acordo inesperado aproxima duas pessoas que juraram nunca se apaixonar.",
    image:
      "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "demo-2",
    title: "Segredo da Meia-Noite",
    category: "Suspense",
    description:
      "Uma descoberta inesperada transforma a vida de uma jovem para sempre.",
    image:
      "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "demo-3",
    title: "Entre Dois Corações",
    category: "Drama",
    description:
      "Entre escolhas difíceis e sentimentos inesperados, o amor terá a última palavra.",
    image:
      "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=900&q=80",
  },
];

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
  const number = episode.episode_number || index + 1;

  const title = (episode.title || "")
    .replace(/^epis[oó]dio\s*\d+\s*[-:.]?\s*/i, "")
    .trim();

  return {
    number,
    title,
    displayTitle: title
      ? `Episódio ${number} — ${title}`
      : `Episódio ${number}`,
  };
}

export default function App() {
  const videoRef = useRef(null);

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
      return JSON.parse(localStorage.getItem("dramovix-favorites") || "[]");
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
          { data: moviesData },
          { data: channelsData },
        ] = await Promise.all([
          supabase.from("series").select("*"),
          supabase.from("movies").select("*"),
          supabase.from("channels").select("*"),
        ]);

        if (cancelled) return;

        if (seriesError) {
          throw seriesError;
        }

        setSeries(
          seriesData?.length
            ? seriesData
            : DEMO_SERIES
        );

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

        setSeries(DEMO_SERIES);
        setMovies([]);
        setDbChannels([]);
        setError(
          "Não foi possível carregar todo o catálogo do Supabase. Verifique sua conexão e as tabelas."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  // Salva os favoritos no navegador.
  useEffect(() => {
    localStorage.setItem(
      "dramovix-favorites",
      JSON.stringify(favorites)
    );
  }, [favorites]);

  // Carrega os episódios da minissérie selecionada.
  useEffect(() => {
    let cancelled = false;

    async function loadEpisodes() {
      if (!selectedSeries) {
        setEpisodes([]);
        return;
      }

      if (String(selectedSeries.id).startsWith("demo-")) {
        setEpisodes([]);
        return;
      }

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

  // Importa a playlist selecionada.
  useEffect(() => {
    let cancelled = false;

    async function loadPlaylist() {
      const playlist = PLAYLISTS[channelSource];

      if (!playlist) {
        setPlaylistChannels([]);
        return;
      }

      setPlaylistLoading(true);

      try {
        const response = await fetch(playlist.url);

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
        console.error("Erro ao importar playlist:", err);

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
    };
  }, [channelSource]);

  // Abre o player de vídeo.
  function openPlayer(item, type = "movie") {
    const videoUrl =
      item.video_url ||
      item.stream_url ||
      item.url ||
      "";

    if (!videoUrl) {
      setPlayerError(
        "Este conteúdo ainda não possui um link de vídeo cadastrado."
      );
      setCurrentVideo(item);
      setPlayerOpen(true);
      return;
    }

    setPlayerError("");

    setCurrentVideo({
      ...item,
      url: videoUrl,
      type,
      name:
        item.name ||
        item.title ||
        "Dramovix",
    });

    setPlayerOpen(true);
  }

  function closePlayer() {
    setPlayerOpen(false);
    setCurrentVideo(null);
    setPlayerError("");
  }

  // Configura o vídeo e o suporte a HLS.
  useEffect(() => {
    const video = videoRef.current;

    if (!playerOpen || !currentVideo || !video) return;

    const url =
      currentVideo.video_url ||
      currentVideo.stream_url ||
      currentVideo.url;

    if (!url) {
      setPlayerError(
        "Nenhum link de vídeo foi informado para este conteúdo."
      );
      return;
    }

    let hls = null;
    let cancelled = false;

    setPlayerError("");

    video.pause();
    video.removeAttribute("src");
    video.load();

    if (
      /\.m3u8($|\?)/i.test(url) &&
      Hls.isSupported()
    ) {
      hls = new Hls();

      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!cancelled) {
          video.play().catch(() => {});
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal && !cancelled) {
          setPlayerError(
            "Não foi possível reproduzir este canal ou vídeo. Tente outro link."
          );
        }
      });
    } else if (
      /\.m3u8($|\?)/i.test(url) &&
      video.canPlayType("application/vnd.apple.mpegurl")
    ) {
      video.src = url;

      video.play().catch(() => {});
    } else {
      video.src = url;

      video.play().catch(() => {});
    }

    return () => {
      cancelled = true;

      if (hls) {
        hls.destroy();
      }

      video.pause();
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
        (
          section !== "Favoritos" ||
          isFavorite(item)
        )
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

    body {
      margin: 0;
      background: #080910;
      color: #f8f8fc;
      font-family: Arial, Helvetica, sans-serif;
    }

    button, input, select {
      font: inherit;
    }

    button {
      cursor: pointer;
    }

    .dv-app {
      min-height: 100vh;
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
      gap: 20px;
      padding: 16px 5%;
      background: rgba(8, 9, 16, .94);
      border-bottom: 1px solid #252530;
      backdrop-filter: blur(16px);
    }

    .dv-logo {
      font-size: 25px;
      font-weight: 900;
      letter-spacing: -1px;
      color: #fff;
      cursor: pointer;
    }

    .dv-logo span {
      color: #e34bff;
    }

    .dv-nav {
      display: flex;
      align-items: center;
      gap: 7px;
      flex-wrap: wrap;
    }

    .dv-nav button {
      color: #b9b9c8;
      background: transparent;
      border: 0;
      padding: 10px 12px;
      border-radius: 9px;
    }

    .dv-nav button.active,
    .dv-nav button:hover {
      color: #fff;
      background: #292033;
    }

    .dv-search {
      width: 210px;
      max-width: 100%;
      padding: 11px 14px;
      color: white;
      background: #171720;
      border: 1px solid #30303d;
      border-radius: 12px;
      outline: none;
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
      grid-template-columns: minmax(180px, 300px) 1fr;
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
    }

    .dv-player-overlay {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: grid;
      place-items: center;
      padding: 18px;
      background: rgba(0,0,0,.88);
      backdrop-filter: blur(8px);
    }

    .dv-player-modal {
      width: min(100%, 900px);
      overflow: hidden;
      background: #101018;
      border: 1px solid #3b3044;
      border-radius: 17px;
    }

    .dv-player-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 15px;
      padding: 14px 17px;
    }

    .dv-player-top h3 {
      margin: 0;
      font-size: 15px;
    }

    .dv-player-close {
      width: 38px;
      height: 38px;
      color: white;
      background: #292532;
      border: 0;
      border-radius: 10px;
      font-size: 22px;
    }

    .dv-video-wrap {
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

    .dv-player-error {
      padding: 15px;
      color: #ffb9c2;
      font-size: 13px;
    }

    .dv-footer {
      padding: 25px 5%;
      border-top: 1px solid #282833;
      text-align: center;
      color: #777687;
      font-size: 12px;
    }

    @media (max-width: 760px) {
      .dv-header {
        align-items: flex-start;
        flex-wrap: wrap;
        gap: 12px;
        padding: 14px 4%;
      }

      .dv-nav {
        order: 3;
        width: 100%;
        overflow-x: auto;
        flex-wrap: nowrap;
      }

      .dv-nav button {
        flex-shrink: 0;
      }

      .dv-search {
        width: 170px;
      }

      .dv-main {
        padding: 18px 4% 45px;
      }

      .dv-hero {
        min-height: 260px;
        padding: 23px;
        border-radius: 16px;
      }

      .dv-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .dv-card-body {
        padding: 10px;
      }

      .dv-card h3 {
        font-size: 13px;
      }

      .dv-detail {
        grid-template-columns: 1fr;
        gap: 20px;
      }

      .dv-detail-poster {
        width: min(70%, 250px);
        max-height: 330px;
      }

      .dv-episodes {
        grid-template-columns: 1fr;
      }

      .dv-channel-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
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
                setCategory("Todas");
              }}
            >
              {item}
            </button>
          ))}
        </nav>

        <input
          className="dv-search"
          type="search"
          placeholder="Buscar conteúdo..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </header>

      <main className="dv-main">
        {error && (
          <div className="dv-notice">{error}</div>
        )}

        {selectedSeries ? (
          <>
            <button
              className="dv-secondary dv-back"
              onClick={() => {
                setSelectedSeries(null);
                setEpisodes([]);
              }}
            >
              ← Voltar ao catálogo
            </button>

            <section className="dv-detail">
              <img
                className="dv-detail-poster"
                src={
                  selectedSeries.image ||
                  selectedSeries.poster_url ||
                  "https://placehold.co/600x800/171721/ffffff?text=Dramovix"
                }
                alt={selectedSeries.title}
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
                    onClick={() =>
                      toggleFavorite(selectedSeries)
                    }
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
                      } = normalizeEpisodeTitle(
                        episode,
                        index
                      );

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
                                  episode.url,
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
                Nenhum canal encontrado. Tente outra fonte ou
                categoria.
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
                          event.currentTarget.style.display = "none";
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
                          "https://placehold.co/600x800/171721/ffffff?text=Filme"
                        }
                        alt={movie.title}
                        loading="lazy"
                      />
                    </div>

                    <div className="dv-card-body">
                      <h3>{movie.title}</h3>
                      <p>{movie.category || "Filme"}</p>

                      <div className="dv-card-actions">
                        <button
                          onClick={() =>
                            openPlayer(movie, "movie")
                          }
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
                Nenhuma minissérie encontrada.
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
                        src={
                          item.image ||
                          item.poster_url ||
                          "https://placehold.co/600x800/171721/ffffff?text=Dramovix"
                        }
                        alt={item.title}
                        loading="lazy"
                      />
                    </div>

                    <div className="dv-card-body">
                      <h3>{item.title}</h3>

                      <p>
                        {item.category || "Minissérie"}
                      </p>

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
                    Os filmes aparecerão aqui quando forem
                    cadastrados no Supabase.
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
                              "https://placehold.co/600x800/171721/ffffff?text=Filme"
                            }
                            alt={movie.title}
                            loading="lazy"
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
          <div className="dv-player-modal">
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
                ref={videoRef}
                className="dv-video"
                controls
                playsInline
                autoPlay
                preload="metadata"
              />
            </div>

            {playerError && (
              <div className="dv-player-error">
                {playerError}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
