import { useState, useEffect, useRef } from "react";
import Hls from "hls.js";
import { supabase } from "./supabase";
import "./App.css";

const categories = [
  "Todas",
  "Romance",
  "Vingança",
  "Suspense",
  "Bilionários",
  "Casamento",
];

function getSavedFavorites() {
  try {
    return JSON.parse(localStorage.getItem("dramovix-favorites") || "[]");
  } catch {
    return [];
  }
}

function parseM3U(playlist) {
  const channels = [];
  const lines = playlist.split(/\r?\n/);
  let currentInfo = "";

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) continue;
    if (line.startsWith("#EXTINF:")) {
      currentInfo = line;
      continue;
    }
    if (line.startsWith("#")) continue;
    if (currentInfo && /^https?:\/\//i.test(line)) {
      const nameMatch = currentInfo.match(/,(.*)$/);
      const logoMatch = currentInfo.match(/tvg-logo="([^"]*)"/i);
      const groupMatch = currentInfo.match(/group-title="([^"]*)"/i);
      channels.push({
        id: `iptv-${channels.length}`,
        title: nameMatch?.[1]?.trim() || "Canal brasileiro",
        category: groupMatch?.[1]?.trim() || "Brasil",
        description: "Canal da playlist pública",
        image: logoMatch?.[1] || "",
        video_url: line,
        source: "iptv-org",
      });
    }
    currentInfo = "";
  }

  return channels;
}

export default function App() {
  const [currentTab, setCurrentTab] = useState("series");
  const [dbSeries, setDbSeries] = useState([]);
  const [dbMovies, setDbMovies] = useState([]);
  const [dbChannels, setDbChannels] = useState([]);
  const [githubChannels, setGithubChannels] = useState([]);

  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState("");
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channelsError, setChannelsError] = useState("");

  const [category, setCategory] = useState("Todas");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [episodesError, setEpisodesError] = useState("");
  const [playing, setPlaying] = useState(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [favorites, setFavorites] = useState(getSavedFavorites);
  const [channelCountry, setChannelCountry] = useState("BR");

  const videoRef = useRef(null);

  // Carregar minisséries
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
        console.error("Erro ao carregar séries:", error);
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

  // Carregar filmes do Supabase
  useEffect(() => {
    let active = true;

    async function loadMovies() {
      const { data, error } = await supabase
        .from("movies")
        .select("*")
        .eq("published", true);
      if (!active) return;
      if (error) {
        console.warn("Não foi possível carregar filmes:", error.message);
        return;
      }
      setDbMovies(
        (data || []).map((item) => ({
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
    loadMovies();
    return () => {
      active = false;
    };
  }, []);

  // Carregar canais cadastrados no Supabase
  useEffect(() => {
    let active = true;

    async function loadChannels() {
      const { data, error } = await supabase
        .from("channels")
        .select("*")
        .eq("published", true);
      if (!active) return;
      if (error) {
        console.error("Erro ao carregar canais do Supabase:", error.message);
        return;
      }
      setDbChannels(
        (data || []).map((item) => ({
          id: `channel-${item.id}`,
          dbId: item.id,
          title: item.name || item.title || "Canal",
          category: item.category || "Ao Vivo",
          description: item.description || "Canal de TV ao vivo",
          image: item.logo_url || item.cover_url || "",
          video_url: item.stream_url || item.video_url || "",
          source: "supabase",
        }))
      );
    }
    loadChannels();
    return () => {
      active = false;
    };
  }, []);

  // Importar automaticamente canais brasileiros da playlist M3U
  useEffect(() => {
    let active = true;

    async function loadBrazilChannels() {
      setChannelsLoading(true);
      setChannelsError("");
      try {
        const response = await fetch(
          "https://iptv-org.github.io/iptv/countries/br.m3u"
        );
        if (!response.ok) {
          throw new Error(`Erro HTTP ${response.status}`);
        }
        const playlist = await response.text();
        const channels = parseM3U(playlist);
        if (active) {
          setGithubChannels(channels);
        }
      } catch (error) {
        console.error("Erro ao importar playlist:", error);
        if (active) {
          setChannelsError(
            "Não foi possível carregar a lista automática. Os canais do Supabase continuam disponíveis."
          );
        }
      } finally {
        if (active) setChannelsLoading(false);
      }
    }
    loadBrazilChannels();
    return () => {
      active = false;
    };
  }, []);

  // Salvar favoritos
  useEffect(() => {
    try {
      localStorage.setItem(
        "dramovix-favorites",
        JSON.stringify(favorites)
      );
    } catch (error) {
      console.warn("Não foi possível salvar favoritos.", error);
    }
  }, [favorites]);

  // Carregar episódios da série selecionada
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
        console.error("Erro ao carregar episódios:", error);
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

  // Player de vídeo e suporte HLS
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playing?.video_url) return;

    const url = playing.video_url;
    let hls = null;

    if (url.includes(".m3u8")) {
      if (Hls.isSupported()) {
        hls = new Hls();
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            console.error("Erro fatal no HLS:", data.type, data.details);
          }
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url;
        video.addEventListener("loadedmetadata", () => {
          video.play().catch(() => {});
        });
      }
    } else {
      video.src = url;
      video.play().catch(() => {});
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [playing]);

  // Catálogo da aba atual
  const catalog =
    currentTab === "movies"
      ? dbMovies
      : currentTab === "channels"
      ? [...dbChannels, ...githubChannels]
      : dbSeries;

  const filtered = catalog.filter((item) => {
    const matchesCategory =
      currentTab !== "series" ||
      category === "Todas" ||
      item.category === category;

    const matchesSearch = (item.title || "")
      .toLowerCase()
      .includes(search.trim().toLowerCase());
    const matchesFavorites =
      !showFavorites || favorites.includes(String(item.id));
    const matchesCountry =
      currentTab !== "channels" ||
      channelCountry !== "BR" ||
      item.source !== "iptv-org" ||
      true;
    return (
      matchesCategory &&
      matchesSearch &&
      matchesFavorites &&
      matchesCountry
    );
  });

  const featured = catalog[0] || null;

  function openItem(item) {
    if (currentTab === "channels" || currentTab === "movies") {
      if (!item.video_url) {
        alert("Este conteúdo ainda não tem um link de reprodução.");
        return;
      }
      setPlaying({
        ...item,
        title: item.title,
        video_url: item.video_url,
      });
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
