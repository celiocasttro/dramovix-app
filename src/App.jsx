import { useState, useEffect } from "react";
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
    return JSON.parse(
      localStorage.getItem("dramovix-favorites") || "[]"
    );
  } catch {
    return [];
  }
}

export default function App() {
  const [currentTab, setCurrentTab] = useState("series"); // "series" | "movies" | "channels"
  const [dbSeries, setDbSeries] = useState([]);
  const [dbMovies, setDbMovies] = useState([]);
  const [dbChannels, setDbChannels] = useState([]);
  const [iptvChannels, setIptvChannels] = useState([]);
  const [loadingIptv, setLoadingIptv] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState("");
  const [category, setCategory] = useState("Todas");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [episodesError, setEpisodesError] = useState("");
  const [playing, setPlaying] = useState(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [favorites, setFavorites] = useState(getSavedFavorites);

  // Carregar Séries
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

  // Carregar Filmes
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

  // Carregar Canais do Supabase + Lista IPTV em Português do GitHub
  useEffect(() => {
    async function loadAllChannels() {
      // 1. Carrega do Supabase
      let customChannels = [];
      const { data } = await supabase
        .from("channels")
        .select("*")
        .eq("published", true);

      if (data) {
        customChannels = data.map((item) => ({
          id: `channel-${item.id}`,
          title: item.name || item.title,
          category: "Ao Vivo (Personalizado)",
          description: item.description || "Canal de TV ao vivo",
          image: item.logo_url || "https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=500&auto=format&fit=crop&q=60",
          video_url: item.stream_url || item.video_url || "",
        }));
      }

      setDbChannels(customChannels);

      // 2. Carrega e processa a lista pública de canais em Português (por.m3u)
      setLoadingIptv(true);
      try {
        const response = await fetch("https://iptv-org.github.io/iptv/languages/por.m3u");
        const text = await response.text();
        
        const lines = text.split("\n");
        const parsedChannels = [];
        let currentTitle = "";
        let currentLogo = "";

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          if (line.startsWith("#EXTINF:")) {
            const parts = line.split(",");
            currentTitle = parts[parts.length - 1] || "Canal em Português";

            const logoMatch = line.match(/tvg-logo="([^"]*)"/);
            currentLogo = logoMatch ? logoMatch[1] : "";
          } else if (line && !line.startsWith("#")) {
            const streamUrl = line;
            
            if (currentTitle && streamUrl) {
              parsedChannels.push({
                id: `iptv-${parsedChannels.length}`,
                title: currentTitle.trim(),
                category: "IPTV Português",
                description: "Transmissão pública em português",
                image: currentLogo || "https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=500&auto=format&fit=crop&q=60",
                video_url: streamUrl,
              });
            }
            currentTitle = "";
            currentLogo = "";
          }

          if (parsedChannels.length >= 150) break;
        }

        setIptvChannels(parsedChannels);
      } catch (err) {
        console.warn("Não foi possível carregar a lista IPTV em português.", err);
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
      console.warn("Não foi possível salvar favoritos.", error);
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

  const allChannelsList = [...dbChannels, ...iptvChannels];

  const catalog =
    currentTab === "movies"
      ? dbMovies
      : currentTab === "channels"
      ? allChannelsList
      : dbSeries;

  const filtered = catalog.filter((item) => {
    const matchesCategory =
      currentTab !== "series" || category === "Todas" || item.category === category;

    const matchesSearch = item.title
      .toLowerCase()
      .includes(search.trim().toLowerCase());

    const matchesFavorites =
      !showFavorites || favorites.includes(String(item.id));

    return matchesCategory && matchesSearch && matchesFavorites;
  });

  const featured = catalog[0] || null;

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
    <div className="dv-app">
      <style>{`
        .dv-app {
          min-height: 100vh;
          background: #10091b;
          color: #fff;
          font-family: Inter, Arial, sans-serif;
        }
        .dv-app * { box-sizing: border-box; }
        .dv-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 18px 5%;
          background: #170d25;
          border-bottom: 1px solid #30203e;
          flex-wrap: wrap;
        }
        .dv-logo {
          color: #c084fc;
          font-size: 28px;
          font-weight: 900;
          letter-spacing: 2px;
          cursor: pointer;
        }
        .dv-nav-tabs {
          display: flex;
          gap: 8px;
        }
        .dv-nav-tab {
          background: #241532;
          border: 1px solid #49345c;
          color: #d8b4fe;
          padding: 8px 14px;
          border-radius: 16px;
          cursor: pointer;
          font-weight: 600;
        }
        .dv-nav-tab.active {
          background: #9333ea;
          color: #fff;
          border-color: #a855f7;
        }
        .dv-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .dv-search {
          width: min(260px, 100%);
          padding: 10px 14px;
          border: 1px solid #49345c;
          border-radius: 24px;
          background: #241532;
          color: white;
          outline: none;
        }
        .dv-main {
          width: 90%;
          max-width: 1400px;
          margin: auto;
        }
        .dv-section-title { font-size: 24px; margin: 0 0 8px; }
        .dv-subtitle { color: #b9a8c8; margin: 0 0 22px; }
        .dv-grid {
          display: grid;
          grid-template-columns: repeat(3,minmax(0,1fr));
          gap: 22px;
          padding-bottom: 48px;
        }
        .dv-card {
          min-width: 0;
          position: relative;
          background: #190f25;
          border: 1px solid #30203e;
          border-radius: 15px;
          overflow: hidden;
        }
        .dv-card-click {
          display: block;
          width: 100%;
          padding: 0;
          text-align: left;
          color: inherit;
          background: none;
          border: 0;
          cursor: pointer;
        }
        
