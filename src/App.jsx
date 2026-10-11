import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import "./App.css";

const seriesCategories = [
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

const categoryTranslations = {
  "Animation": "Animação",
  "Auto": "Automobilismo",
  "Business": "Negócios",
  "Classic": "Clássicos",
  "Comedy": "Comédia",
  "Cooking": "Culinária",
  "Culture": "Cultura",
  "Documentary": "Documentários",
  "Education": "Educação",
  "Entertainment": "Entretenimento",
  "Family": "Família",
  "General": "Geral",
  "Interactive": "Interativo",
  "Kids": "Infantil",
  "Legislative": "Legislativo",
  "Lifestyle": "Estilo de Vida",
  "Movies": "Filmes",
  "Music": "Música",
  "News": "Notícias",
  "Outdoor": "Ao Ar Livre",
  "Public": "Público",
  "Relax": "Relaxamento",
  "Religious": "Religioso",
  "Science": "Ciência",
  "Series": "Séries",
  "Shop": "Compras",
  "Sports": "Esportes",
  "Travel": "Viagem",
  "Weather": "Previsão do Tempo",
  "Undefined": "Indefinido"
};

const categoryPlaylistUrls = [
  { name: "Animation", url: "https://iptv-org.github.io/iptv/categories/animation.m3u" },
  { name: "Auto", url: "https://iptv-org.github.io/iptv/categories/auto.m3u" },
  { name: "Business", url: "https://iptv-org.github.io/iptv/categories/business.m3u" },
  { name: "Classic", url: "https://iptv-org.github.io/iptv/categories/classic.m3u" },
  { name: "Comedy", url: "https://iptv-org.github.io/iptv/categories/comedy.m3u" },
  { name: "Cooking", url: "https://iptv-org.github.io/iptv/categories/cooking.m3u" },
  { name: "Culture", url: "https://iptv-org.github.io/iptv/categories/culture.m3u" },
  { name: "Documentary", url: "https://iptv-org.github.io/iptv/categories/documentary.m3u" },
  { name: "Education", url: "https://iptv-org.github.io/iptv/categories/education.m3u" },
  { name: "Entertainment", url: "https://iptv-org.github.io/iptv/categories/entertainment.m3u" },
  { name: "Family", url: "https://iptv-org.github.io/iptv/categories/family.m3u" },
  { name: "General", url: "https://iptv-org.github.io/iptv/categories/general.m3u" },
  { name: "Kids", url: "https://iptv-org.github.io/iptv/categories/kids.m3u" },
  { name: "Lifestyle", url: "https://iptv-org.github.io/iptv/categories/lifestyle.m3u" },
  { name: "Movies", url: "https://iptv-org.github.io/iptv/categories/movies.m3u" },
  { name: "Music", url: "https://iptv-org.github.io/iptv/categories/music.m3u" },
  { name: "News", url: "https://iptv-org.github.io/iptv/categories/news.m3u" },
  { name: "Series", url: "https://iptv-org.github.io/iptv/categories/series.m3u" },
  { name: "Sports", url: "https://iptv-org.github.io/iptv/categories/sports.m3u" },
  { name: "Travel", url: "https://iptv-org.github.io/iptv/categories/travel.m3u" }
];

export default function App() {
  const [currentTab, setCurrentTab] = useState("series");
  const [dbSeries, setDbSeries] = useState([]);
  const [dbMovies, setDbMovies] = useState([]);
  const [dbChannels, setDbChannels] = useState([]);
  const [iptvChannels, setIptvChannels] = useState([]);
  const [loadingIptv, setLoadingIptv] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState("");
  const [seriesCategory, setSeriesCategory] = useState("Todas");
  const [channelCategory, setChannelCategory] = useState("Todas");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [episodesError, setEpisodesError] = useState("");
  const [playing, setPlaying] = useState(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [favorites, setFavorites] = useState(getSavedFavorites);

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

  useEffect(() => {
    async function loadAllChannels() {
      let customChannels = [];
      const { data } = await supabase
        .from("channels")
        .select("*")
        .eq("published", true);

      if (data) {
        customChannels = data.map((item) => ({
          id: `channel-${item.id}`,
          title: item.name || item.title,
          category: item.category || "Personalizado",
          description: item.description || "Canal de TV ao vivo",
          image: item.logo_url || "https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=500&auto=format&fit=crop&q=60",
          video_url: item.stream_url || item.video_url || "",
        }));
      }

      setDbChannels(customChannels);

      setLoadingIptv(true);
      try {
        const allParsed = [];
        const seenUrls = new Set();

        for (const cat of categoryPlaylistUrls) {
          try {
            const response = await fetch(cat.url);
            const text = await response.text();
            const lines = text.split("\n");
            let currentTitle = "";
            let currentLogo = "";
            const translatedCatName = categoryTranslations[cat.name] || cat.name;

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              
              if (line.startsWith("#EXTINF:")) {
                const parts = line.split(",");
                currentTitle = parts[parts.length - 1] || "Canal IPTV";

                const logoMatch = line.match(/tvg-logo="([^"]*)"/);
                currentLogo = logoMatch ? logoMatch[1] : "";
              } else if (line && !line.startsWith("#")) {
                const streamUrl = line;
                
                if (currentTitle && streamUrl && !seenUrls.has(streamUrl)) {
                  seenUrls.add(streamUrl);
                  allParsed.push({
                    id: `iptv-${allParsed.length}`,
                    title: currentTitle.trim(),
                    category: translatedCatName,
                    description: `Transmissão de ${translatedCatName}`,
                    image: currentLogo || "https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=500&auto=format&fit=crop&q=60",
                    video_url: streamUrl,
                  });
                }
                currentTitle = "";
                currentLogo = "";
              }
            }
          } catch (subErr) {
            console.warn(subErr);
          }
        }

        setIptvChannels(allParsed);
      } catch (err) {
        console.warn(err);
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
      console.warn(error);
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

  const availableChannelCategories = [
    "Todas",
    ...new Set(allChannelsList.map((item) => item.category))
  ];

  const catalog =
    currentTab === "movies"
      ? dbMovies
      : currentTab === "channels"
      ? allChannelsList
      : dbSeries;

  const filtered = catalog.filter((item) => {
    let matchesCategory = true;
    if (currentTab === "series") {
      matchesCategory = seriesCategory === "Todas" || item.category === seriesCategory;
    } else if (currentTab === "channels") {
      matchesCategory = channelCategory === "Todas" || item.category === channelCategory;
    }

    const matchesSearch = item.title
      .toLowerCase()
      .includes(search.trim().toLowerCase());

    const matchesFavorites =
      !showFavorites || favorites.includes(String(item.id));

    return matchesCategory && matchesSearch && matchesFavorites;
  });

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
          padding-bottom: 50px;
        }
        .dv-section-title { font-size: 24px; margin: 0 0 8px; }
        .dv-subtitle { color: #b9a8c8; margin: 0 0 22px; }
        .dv-categories {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin: 20px 0 28px;
        }
        .dv-category {
          padding: 8px 14px;
          border-radius: 20px;
          background: #241532;
          color: #e9d5ff;
          border: 1px solid #49345c;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
        }
        .dv-category.active {
          background: #7e22ce;
          border-color: #a855f7;
        }
        .dv-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
          padding-bottom: 48px;
        }
        .dv-card {
          min-width: 0;
          position: relative;
          background: #190f25;
          border: 1px solid #30203e;
          border-radius: 15px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
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
          flex: 1;
        }
        .dv-cover {
          width: 100%;
          aspect-
