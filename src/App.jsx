import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import Hls from "hls.js";
import "./App.css";
const ZNATION_URL =
  "https://epg.provider.plex.tv/library/parts/646546f35db8ada4c8edd7e5-67d1be3696c7b08c26c19d64.m3u8?includeAllStreams=1&x-plex-product=Plex+Mediaverse&x-plex-token=MZFkHw1Atc9c9bZLRyWw&auto=0";
const DEFAULT_COVER = "";
const DEFAULT_MOVIE_COVER = "";
const LIVE_SERIES = {
  id: "live-znation",
  title: "Z Nation",
  category: "Ao vivo",
  description: "Assista à transmissão de Z Nation.",
  image:
    "https://svinrjrlrlitipleiccb.supabase.co/storage/v1/object/public/dramovix-videos/Capas/Znation.PNG",
  video_url: ZNATION_URL,
  isLive: true,
};
const normalize = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
function getContentType(item) {
  const title = normalize(item.title);
  const genre = normalize(item.category || item.genre || "");
  const explicitType = normalize(item.content_type || item.contentType || "");
  if (explicitType) {
    if (explicitType.includes("desen")) return "desenhos";
    if (explicitType.includes("anime")) return "animes";
    if (explicitType.includes("dorama")) return "doramas";
    if (explicitType.includes("filme")) return "filmes";
    if (explicitType.includes("serie")) return "series";
  }
  if (
    genre.includes("dorama") ||
    genre.includes("k-drama") ||
    genre.includes("kdrama")
  ) {
    return "doramas";
  }
  if (
    genre.includes("anime") ||
    genre.includes("shounen") ||
    genre.includes("shonen") ||
    genre.includes("isekai")
  ) {
    return "animes";
  }
  if (
    genre.includes("desenho") ||
    genre.includes("cartoon") ||
    genre.includes("infantil") ||
    genre.includes("kids") ||
    genre.includes("animacao") ||
    /bob esponja|meninas super poderosas|jovens tita|pantera cor de rosa|coragem o cao|familia urso|jackie chan|avatar a lenda|dragon ball|tom e jerry|pica-pau|scooby-doo|scooby doo|ben 10|hora de aventura|apenas um show|gumball|steven universo|finn e jake/.test(
      title
    )
  ) {
    return "desenhos";
  }
  return "series";
}
function getVisitorId() {
  const key = "dramovix-visitor-id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = `DV-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}${Date.now().toString(36).slice(-4).toUpperCase()}`;
    localStorage.setItem(key, id);
  }
  return id;
}
/* Não substitui capas quebradas pela imagem de Z Nation. */
function hideBrokenImage(event) {
  const image = event.currentTarget;
  image.onerror = null;
  image.removeAttribute("src");
  image.style.visibility = "hidden";
}
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
  const [genreFilter, setGenreFilter] = useState("Todas");
  const [page, setPage] = useState("filmes");
  const [profileOpen, setProfileOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("signin");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");
  const [language, setLanguage] = useState(
    () => localStorage.getItem("dramovix-language") || "Português"
  );
  const [visitorId, setVisitorId] = useState(() => getVisitorId());
  const [watchHistory, setWatchHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("dramovix-history") || "[]");
    } catch {
      return [];
    }
  });
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("dramovix-favorites") || "[]");
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
    localStorage.setItem("dramovix-favorites", JSON.stringify(favorites));
  }, [favorites]);
  useEffect(() => {
    localStorage.setItem("dramovix-history", JSON.stringify(watchHistory));
  }, [watchHistory]);
  useEffect(() => {
    localStorage.setItem("dramovix-language", language);
  }, [language]);
  const translations = {
    English: {
      Início: "Home",
      Filmes: "Movies",
      Séries: "Series",
      Desenhos: "Cartoons",
      Anime: "Anime",
      Doramas: "Dramas",
      "TV Ao Vivo": "Live TV",
      Buscar: "Search",
      "Minha Lista": "My List",
      Perfil: "Profile",
      "Meu perfil": "My profile",
      "Visitante DRAMOVIX": "DRAMOVIX Guest",
      "Seu ID de visitante": "Your visitor ID",
      "Copiar ID": "Copy ID",
      "Mudança de linguagem": "Language",
      "Veja o histórico": "Watch history",
      "Limpar cache": "Clear local data",
      "Você pode assistir sem criar uma conta.": "You can watch without creating an account.",
      "EM DESTAQUE": "FEATURED",
      "Continue assistindo": "Continue watching",
      "Ver histórico ›": "Watch history ›",
      FILMES: "MOVIES",
      SÉRIES: "SERIES",
      DESENHOS: "CARTOONS",
      "TV AO VIVO": "LIVE TV",
      Episódios: "Episodes",
      "Assistir filme": "Watch movie",
      "Assistir 1º Episódio": "Watch first episode",
      "Nenhum conteúdo encontrado": "No content found",
      "Carregando catálogo...": "Loading catalog...",
      "Sempre tem uma nova história.": "There's always a new story.",
      Vingança: "Revenge",
      Bilionários: "Billionaires",
      Casamento: "Marriage",
      Ação: "Action",
      Aventura: "Adventure",
      Comédia: "Comedy",
      Drama: "Drama",
      Fantasia: "Fantasy",
      Mistério: "Mystery",
      "Ficção Científica": "Science Fiction",
      Categorias: "Categories",
      "Desenhos e animações para curtir.": "Cartoons and animation to enjoy.",
      "Animações japonesas.": "Japanese animation.",
      "Séries asiáticas de sucesso.": "Popular Asian dramas.",
      "Filmes disponíveis no catálogo.": "Movies available in the catalog.",
      "Maratone as melhores séries e minisséries.": "Binge the best series and miniseries.",
      "Buscar conteúdo": "Search content",
      "Pesquise filmes, séries, desenhos, animes e doramas.": "Search movies, series, cartoons, anime, and dramas.",
      "O que deseja assistir?": "What do you want to watch?",
      "Séries, desenhos, animes e doramas": "Series, cartoons, anime, and dramas",
      Histórico: "History",
      "Conteúdos reproduzidos neste navegador.": "Content played in this browser.",
      "Limpar histórico": "Clear history",
      "Seu histórico está vazio": "Your history is empty",
      "Quando você assistir a algo, aparecerá aqui.": "When you watch something, it will appear here.",
      "Novos episódios em breve": "New episodes coming soon",
      "Estamos preparando os capítulos desta série para você.": "We are preparing this series episodes for you.",
      "Ler descrição completa": "Read full description",
      "Mostrar menos": "Show less",
      "Pronto para reprodução": "Ready to play",
      "Em breve": "Coming soon",
      "Selecionar episódio": "Select episode",
      "Próximo episódio": "Next episode",
      "Transmissão ao vivo": "Live stream",
      "Filme · DRAMOVIX": "Movie · DRAMOVIX",
      Assistir: "Watch",
      "Ver todos ›": "See all ›",
      Animes: "Anime",
      "Voltar ao catálogo": "Back to catalog",
      "Descrição indisponível.": "Description unavailable.",
      "Uma história incrível.": "An amazing story.",
      "Minha lista": "My list",
      "Na minha lista": "In my list",
      Série: "Series",
      Episódio: "Episode",
      "Ao vivo": "Live",
      Reproduzindo: "Now playing",
      "Nenhum canal disponível": "No channels available",
      "Assista às transmissões disponíveis.": "Watch available live streams.",
      "O ID fica salvo neste navegador. Para sincronizar seus dados entre dispositivos, futuramente será necessário criar uma conta.": "Your ID is saved in this browser. To sync your data across devices, an account will be needed in the future.",
      "Séries e animações": "Series and animation",
      "O catálogo está vazio.": "The catalog is empty.",
      "Ainda não há episódios cadastrados para esta série.": "No episodes have been added for this series yet.",
      "Episódios disponíveis": "Available episodes",
      "Aguarde, carregando episódios...": "Please wait, loading episodes...",
      "Não foi possível reproduzir este vídeo. O link pode ter expirado ou o servidor pode bloquear a reprodução.": "This video could not be played. The link may have expired or the server may block playback.",
      "Este conteúdo ainda não possui um link de vídeo.": "This content does not have a video link yet."
    },
    Español: {
      Início: "Inicio",
      Filmes: "Películas",
      Séries: "Series",
      Desenhos: "Dibujos",
      Anime: "Anime",
      Doramas: "Doramas",
      "TV Ao Vivo": "TV en vivo",
      Buscar: "Buscar",
      "Minha Lista": "Mi lista",
      Perfil: "Perfil",
      "Meu perfil": "Mi perfil",
      "Visitante DRAMOVIX": "Visitante DRAMOVIX",
      "Seu ID de visitante": "Tu ID de visitante",
      "Copiar ID": "Copiar ID",
      "Mudança de linguagem": "Idioma",
      "Veja o histórico": "Ver historial",
      "Limpar cache": "Borrar datos locales",
      "Você pode assistir sem criar uma conta.": "Puedes ver contenido sin crear una cuenta.",
      "EM DESTAQUE": "DESTACADO",
      "Continue assistindo": "Seguir viendo",
      "Ver histórico ›": "Ver historial ›",
      FILMES: "PELÍCULAS",
      SÉRIES: "SERIES",
      DESENHOS: "DIBUJOS",
      "TV AO VIVO": "TV EN VIVO",
      Episódios: "Episodios",
      "Assistir filme": "Ver película",
      "Assistir 1º Episódio": "Ver primer episodio",
      "Nenhum conteúdo encontrado": "No se encontró contenido",
      "Carregando catálogo...": "Cargando catálogo...",
      "Sempre tem uma nova história.": "Siempre hay una nueva historia.",
      Vingança: "Venganza",
      Bilionários: "Multimillonarios",
      Casamento: "Matrimonio",
      Ação: "Acción",
      Aventura: "Aventura",
      Comédia: "Comedia",
      Drama: "Drama",
      Fantasia: "Fantasía",
      Mistério: "Misterio",
      "Ficção Científica": "Ciencia ficción",
      Categorias: "Categorías",
      "Desenhos e animações para curtir.": "Dibujos y animaciones para disfrutar.",
      "Animações japonesas.": "Animación japonesa.",
      "Séries asiáticas de sucesso.": "Dramas asiáticos populares.",
      "Filmes disponíveis no catálogo.": "Películas disponibles en el catálogo.",
      "Maratone as melhores séries e minisséries.": "Maratonea las mejores series y miniseries.",
      "Buscar conteúdo": "Buscar contenido",
      "Pesquise filmes, séries, desenhos, animes e doramas.": "Busca películas, series, dibujos, anime y doramas.",
      "O que deseja assistir?": "¿Qué quieres ver?",
      "Séries, desenhos, animes e doramas": "Series, dibujos, anime y doramas",
      Histórico: "Historial",
      "Conteúdos reproduzidos neste navegador.": "Contenido reproducido en este navegador.",
      "Limpar histórico": "Borrar historial",
      "Seu histórico está vazio": "Tu historial está vacío",
      "Quando você assistir a algo, aparecerá aqui.": "Cuando veas algo, aparecerá aquí.",
      "Novos episódios em breve": "Nuevos episodios pronto",
      "Estamos preparando os capítulos desta série para você.": "Estamos preparando los episodios de esta serie para ti.",
      "Ler descrição completa": "Leer descripción completa",
      "Mostrar menos": "Mostrar menos",
      "Pronto para reprodução": "Listo para reproducir",
      "Em breve": "Próximamente",
      "Selecionar episódio": "Seleccionar episodio",
      "Próximo episódio": "Siguiente episodio",
      "Transmissão ao vivo": "Transmisión en vivo",
      "Filme · DRAMOVIX": "Película · DRAMOVIX",
      Assistir: "Ver",
      "Ver todos ›": "Ver todos ›",
      Animes: "Anime",
      "Voltar ao catálogo": "Volver al catálogo",
      "Descrição indisponível.": "Descripción no disponible.",
      "Uma história incrível.": "Una historia increíble.",
      "Minha lista": "Mi lista",
      "Na minha lista": "En mi lista",
      Série: "Serie",
      Episódio: "Episodio",
      "Ao vivo": "En vivo",
      Reproduzindo: "Reproduciendo",
      "Assista às transmissões disponíveis.": "Mira las transmisiones disponibles.",
      "O ID fica salvo neste navegador. Para sincronizar seus dados entre dispositivos, futuramente será necessário criar uma conta.": "Tu ID se guarda en este navegador. Para sincronizar tus datos entre dispositivos, necesitarás una cuenta en el futuro.",
      "Séries e animações": "Series y animación",
      "O catálogo está vazio.": "El catálogo está vacío.",
      "Ainda não há episódios cadastrados para esta série.": "Todavía no hay episodios para esta serie.",
      "Episódios disponíveis": "Episodios disponibles",
      "Aguarde, carregando episódios...": "Espera, cargando episodios...",
      "Não foi possível reproduzir este vídeo. O link pode ter expirado ou o servidor pode bloquear a reprodução.": "No se pudo reproducir este video. El enlace puede haber expirado o el servidor puede bloquear la reproducción.",
      "Este conteúdo ainda não possui um link de vídeo.": "Este contenido aún no tiene un enlace de video."
    }
  };
  const tr = (text) => translations[language]?.[text] || text;
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error("Erro ao verificar sessão:", error);
      if (alive) setUser(data?.session?.user || null);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null);
      }
    );
    return () => {
      alive = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      setLoading(true);
      setLiveChannelsLoading(true);
      try {
        const [seriesResult, moviesResult, liveResult] = await Promise.all([
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
            .order("id", { ascending: true })
        ]);
        if (seriesResult.error) {
          console.error("Erro ao carregar séries:", seriesResult.error);
        }
        if (moviesResult.error) {
          console.error("Erro ao carregar filmes:", moviesResult.error);
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
            category: item.genre || "Série",
            genre: item.genre || "",
            content_type: item.content_type || "",
            description: item.description || "",
            // Não usa a capa de Z Nation como substituta.
            image: item.cover_url || "",
            isLive: false
          }));
        const loadedMovies = (moviesResult.data || []).map((item) => ({
          id: `movie-${item.id}`,
          dbId: item.id,
          title: item.title || "Sem título",
          category: item.genre || "Filme",
          description: item.description || "",
          // Não usa a capa de Z Nation como substituta.
          image: item.cover_url || "",
          video_url: item.video_url || "",
          isMovie: true
        }));
        const loadedLive = (liveResult.data || []).map((item) => ({
          id: `live-channel-${item.id}`,
          dbId: item.id,
          title: item.name || "Canal ao vivo",
          category: item.category || "Ao vivo",
          description: `Assista ao canal ${item.name || "ao vivo"}.`,
          image: item.cover_url || "",
          video_url: item.stream_url || "",
          isLive: true
        }));
        if (!cancelled) {
          setSeries(loadedSeries);
          setMovies(loadedMovies);
          setLiveChannels(liveResult.error ? [] : loadedLive);
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
    if (!selectedSeries || selectedSeries.isLive || !selectedSeries.dbId) {
      setEpisodes([]);
      setEpisodesLoading(false);
      return;
    }
    let cancelled = false;
    async function loadEpisodes() {
      setEpisodesLoading(true);
      try {
        const { data, error } = await supabase
          .from("episodes")
          .select("*")
          .eq("series_id", selectedSeries.dbId)
          .order("episode_number", { ascending: true });
        if (error) throw error;
        if (!cancelled) {
          setEpisodes(
            (data || []).map((ep) => ({
              ...ep,
              title:
                ep.title ||
                `Episódio ${ep.episode_number || ""}`.trim(),
              video_url: ep.video_url || ""
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
    if (!playerOpen || !selectedEpisode || !videoRef.current) return;
    const video = videoRef.current;
    const url = selectedEpisode.video_url || "";
    let hls = null;
    let cancelled = false;
    setPlayerError("");
    if (!url) {
      setPlayerError("Este conteúdo ainda não possui um link de vídeo.");
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
      if (!cancelled) {
        setPlayerError(
          "Não foi possível reproduzir este vídeo. O link pode ter expirado ou o servidor pode bloquear a reprodução."
        );
      }
    };
    video.addEventListener("error", handleVideoError);
    if (isHls && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true
      });
      hlsRef.current = hls;
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        if (!cancelled) hls.loadSource(url);
      });
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!cancelled) video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!cancelled && data.fatal) {
          setPlayerError("Não foi possível carregar a transmissão.");
        }
      });
      hls.attachMedia(video);
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
        if (hlsRef.current === hls) hlsRef.current = null;
      }
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [playerOpen, selectedEpisode]);
  const matchesSearch = (item) =>
    !search.trim() ||
    normalize(item.title).includes(normalize(search)) ||
    normalize(item.description).includes(normalize(search));
  const genreCategories = [
    "Todas",
    "Romance",
    "Vingança",
    "Suspense",
    "Bilionários",
    "Casamento",
    "Ação",
    "Aventura",
    "Comédia",
    "Drama",
    "Fantasia",
    "Mistério",
    "Ficção Científica"
  ];
  const filteredSeries = series
    .filter(matchesSearch)
    .filter(
      (item) =>
        genreFilter === "Todas" ||
        normalize(item.genre || item.category).includes(
          normalize(genreFilter)
        ) ||
        normalize(item.title).includes(normalize(genreFilter))
    );
  const filteredMovies = movies
    .filter(matchesSearch)
    .filter(
      (item) =>
        genreFilter === "Todas" ||
        normalize(item.category || item.genre).includes(
          normalize(genreFilter)
        ) ||
        normalize(item.title).includes(normalize(genreFilter))
    );
  const filteredLiveChannels = liveChannels.filter(matchesSearch);
  const cartoons = filteredSeries.filter(
    (item) => getContentType(item) === "desenhos"
  );
  const anime = filteredSeries.filter(
    (item) => getContentType(item) === "animes"
  );
  const doramas = filteredSeries.filter(
    (item) => getContentType(item) === "doramas"
  );
  const ordinarySeries = filteredSeries.filter(
    (item) => getContentType(item) === "series"
  );
  const favoriteSeries = series.filter((item) =>
    favorites.includes(item.id)
  );
  const favoriteMovies = movies.filter((item) =>
    favorites.includes(item.id)
  );
  const heroItem = series[0] || movies[0];
  const isLandscapePlayer = Boolean(
    selectedEpisode?.isMovie ||
      selectedEpisode?.isLive ||
      selectedSeries?.isLive
  );
  function toggleFavorite(item) {
    if (!item) return;
    setFavorites((prev) =>
      prev.includes(item.id)
        ? prev.filter((id) => id !== item.id)
        : [...prev, item.id]
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
    setProfileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function openMovieDetails(item) {
    setSelectedMovie(item);
    setSelectedSeries(null);
    setSelectedEpisode(null);
    setShowDescription(false);
    setPage("detalhes-filme");
    setProfileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function openPlayer(episode) {
    setSelectedEpisode(episode);
    setPlayerError("");
    setPlayerOpen(true);
    setEpisodeDrawerOpen(false);
    const historyItem = {
      id: episode.id,
      title: episode.title || selectedSeries?.title || "Conteúdo",
      contentTitle:
        selectedSeries?.title ||
        selectedMovie?.title ||
        episode.title ||
        "Conteúdo",
      image: selectedSeries?.image || selectedMovie?.image || "",
      watchedAt: new Date().toISOString(),
      contentType: episode.isMovie
        ? "Filme"
        : episode.isLive
          ? "Ao vivo"
          : "Série"
    };
    setWatchHistory((prev) =>
      [
        historyItem,
        ...prev.filter((entry) => entry.id !== historyItem.id)
      ].slice(0, 100)
    );
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
      isMovie: true
    });
  }
  function openLive(item) {
    setSelectedSeries(item);
    setSelectedMovie(null);
    setSelectedEpisode({
      id: `${item.id}-stream`,
      title: item.title,
      video_url: item.video_url,
      isLive: true
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
    const index = episodes.findIndex(
      (ep) => String(ep.id) === String(selectedEpisode.id)
    );
    if (index >= 0 && index < episodes.length - 1) {
      openPlayer(episodes[index + 1]);
    }
  }
  function handleVideoEnded() {
    if (!selectedEpisode?.isLive) playNextEpisode();
  }
  function goToPage(nextPage) {
    setPage(nextPage);
    if (
      ["filmes", "filmes-lista", "desenhos", "animes", "doramas", "tv"].includes(
        nextPage
      )
    ) {
      setGenreFilter("Todas");
    }
    setSelectedSeries(null);
    setSelectedMovie(null);
    setSelectedEpisode(null);
    setEpisodes([]);
    setSearch("");
    setShowDescription(false);
    setProfileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function clearCache() {
    const confirmed = window.confirm(
      "Limpar cache local do DRAMOVIX? Seus favoritos e histórico também serão apagados deste navegador."
    );
    if (!confirmed) return;
    localStorage.removeItem("dramovix-history");
    localStorage.removeItem("dramovix-favorites");
    localStorage.removeItem("dramovix-language");
    localStorage.removeItem("dramovix-visitor-id");
    setWatchHistory([]);
    setFavorites([]);
    setLanguage("Português");
    setVisitorId(getVisitorId());
    setProfileOpen(false);
    window.alert("Cache local limpo.");
  }
  function openAuth(mode = "signin") {
    setAuthMode(mode);
    setAuthMessage("");
    setAuthError("");
    setAuthPassword("");
    setAuthOpen(true);
    setProfileOpen(false);
  }
  async function submitAuth(event) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthMessage("");
    setAuthError("");
    try {
      const email = authEmail.trim().toLowerCase();
      if (!email || !authPassword) {
        throw new Error("Preencha o e-mail e a senha.");
      }
      if (authMode === "signup") {
        if (authPassword.length < 6) {
          throw new Error("A senha precisa ter pelo menos 6 caracteres.");
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password: authPassword,
          options: {
            data: { full_name: authName.trim() },
            emailRedirectTo: window.location.origin
          }
        });
        if (error) throw error;
        if (data?.session) {
          setUser(data.user || data.session.user);
          setAuthMessage(
            "Conta criada com sucesso! Você já está conectado."
          );
          setTimeout(() => setAuthOpen(false), 900);
        } else {
          setAuthMessage(
            "Cadastro iniciado! Confira seu e-mail e clique no link de confirmação para ativar a conta."
          );
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: authPassword
        });
        if (error) throw error;
        setUser(data.user || null);
        setAuthMessage("Login realizado com sucesso!");
        setTimeout(() => setAuthOpen(false), 500);
      }
    } catch (error) {
      setAuthError(
        error?.message || "Não foi possível concluir. Tente novamente."
      );
    } finally {
      setAuthBusy(false);
    }
  }
  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      window.alert(`Não foi possível sair da conta: ${error.message}`);
      return;
    }
    setUser(null);
    setProfileOpen(false);
    setAuthOpen(false);
    setAuthMessage("");
    setAuthError("");
    window.alert("Você saiu da sua conta DRAMOVIX.");
  }
  function renderGenreFilters() {
    return (
      <div className="dv-genre-filters" aria-label="Filtrar por categoria">
        {genreCategories.map((category) => (
          <button
            key={category}
            className={genreFilter === category ? "active" : ""}
            onClick={() => setGenreFilter(category)}
          >
            {category === "Todas"
              ? language === "English"
                ? "All"
                : "Todas"
              : tr(category)}
          </button>
        ))}
      </div>
    );
  }
  function renderCard(item, type = "series") {
    const favoriteTypeLabel =
      type === "movie"
        ? tr("Filmes")
        : type === "live"
          ? tr("TV Ao Vivo")
          : ({
              desenhos: tr("Desenhos"),
              animes: tr("Animes"),
              doramas: tr("Doramas"),
              series: tr("Séries")
            }[getContentType(item)] || tr("Séries"));
    const openItem = () => {
      if (type === "live") return openLive(item);
      if (type === "movie") return openMovieDetails(item);
      if (type === "history") {
        const original =
          series.find(
            (entry) =>
              entry.title === (item.contentTitle || item.title)
          ) ||
          movies.find(
            (entry) =>
              entry.title === (item.contentTitle || item.title)
          );
        if (original) {
          return original.isMovie
            ? openMovieDetails(original)
            : openSeries(original);
        }
        return;
      }
      return openSeries(item);
    };
    return (
      <article className="dv-card" key={item.id}>
        <button
          className="dv-card-image-button"
          onClick={openItem}
          aria-label={`Abrir ${item.title}`}
        >
          {item.image ? (
            <img
              className="dv-card-image"
              src={item.image}
              alt={item.title}
              loading="lazy"
              onError={hideBrokenImage}
            />
          ) : (
            <span
              className="dv-card-image dv-image-placeholder"
              aria-label="Capa indisponível"
            />
          )}
          {type === "live" && (
            <span className="dv-live-badge">AO VIVO</span>
          )}
          {isFavorite(item) && (
            <span className="dv-favorite-badge">♥</span>
          )}
        </button>
        <div className="dv-card-content">
          <h3 onClick={openItem} title={item.title}>
            {item.title}
          </h3>
          {page === "favoritos" && (
            <small className="dv-card-category">
              {favoriteTypeLabel}
            </small>
          )}
        </div>
      </article>
    );
  }
  function renderGrid(items, type = "series") {
    if (loading && type !== "live") {
      return (
        <p className="dv-message">
          {tr("Carregando catálogo...")}
        </p>
      );
    }
    if (!items.length) {
      return (
        <div className="dv-empty">
          <span>✦</span>
          <h3>{tr("Nenhum conteúdo encontrado")}</h3>
          <p>Tente novamente mais tarde ou escolha outra categoria.</p>
        </div>
      );
    }
    return (
      <div className="dv-grid">
        {items.map((item) => renderCard(item, type))}
      </div>
    );
  }
  const navItems = [
    ["filmes", "⌂", "Início"],
    ["filmes-tab", "▣", "Filmes"],
    ["series", "▤", "Séries"],
    ["desenhos", "🎨", "Desenhos"],
    ["animes", "🎌", "Anime"],
    ["doramas", "♡", "Doramas"],
    ["tv", "◉", "TV Ao Vivo"]
  ];
  return (
    <div className="dv-app">
      <header className="dv-header">
        <button
          className="dv-logo"
          onClick={() => goToPage("filmes")}
          aria-label="DRAMOVIX início"
        >
          DRAMOVIX
        </button>
        <div className="dv-header-right-icons">
          <button
            className="dv-icon-btn"
            onClick={() => {
              setPage("explorar");
              setProfileOpen(false);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            aria-label="Pesquisar"
          >
            ⌕
          </button>
          <button
            className="dv-icon-btn"
            onClick={() => setProfileOpen((v) => !v)}
            aria-label="Perfil"
          >
            ♙
          </button>
        </div>
      </header>
      <nav className="dv-mobile-categories" aria-label="Categorias principais">
        {navItems.map(([key, icon, label]) => (
          <button
            key={key}
            className={
              page === key ||
              (key === "filmes-tab" && page === "filmes-lista")
                ? "active"
                : ""
            }
            onClick={() =>
              key === "filmes-tab"
                ? goToPage("filmes-lista")
                : goToPage(key)
            }
          >
            <span>{icon}</span>
            {tr(label)}
          </button>
        ))}
      </nav>
      <aside className="dv-sidebar">
        <div className="dv-sidebar-label">
          {language === "English"
            ? "MAIN MENU"
            : language === "Español"
              ? "MENÚ PRINCIPAL"
              : "MENU PRINCIPAL"}
        </div>
        {navItems.map(([key, icon, label]) => (
          <button
            key={key}
            className={`dv-side-link ${
              page === key ||
              (key === "filmes-tab" && page === "filmes")
                ? "active"
                : ""
            }`}
            onClick={() => {
              if (key === "filmes-tab") {
                goToPage("filmes-lista");
              } else {
                goToPage(key);
              }
            }}
          >
            <span className="dv-side-icon">{icon}</span>
            <span>{tr(label)}</span>
          </button>
        ))}
        <div className="dv-sidebar-note">
          {tr("Sempre tem uma nova história.")}
        </div>
      </aside>
      {profileOpen && (
        <>
          <button
            className="dv-menu-scrim"
            aria-label="Fechar menu"
            onClick={() => setProfileOpen(false)}
          />
          <section className="dv-profile-menu" aria-label="Menu de perfil">
            <div className="dv-profile-top">
              <div className="dv-profile-avatar">♙</div>
              <div>
                <strong>
                  {user?.user_metadata?.full_name ||
                    user?.email?.split("@")[0] ||
                    tr("Meu perfil")}
                </strong>
                <small>{user?.email || tr("Visitante DRAMOVIX")}</small>
              </div>
              <button
                className="dv-profile-close"
                onClick={() => setProfileOpen(false)}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            {!user && (
              <div className="dv-profile-id">
                <small>{tr("Seu ID de visitante")}</small>
                <strong>{visitorId}</strong>
                <button
                  onClick={() => navigator.clipboard?.writeText(visitorId)}
                >
                  {tr("Copiar ID")}
                </button>
              </div>
            )}
            {!user ? (
              <>
                <button
                  className="dv-profile-auth-button"
                  onClick={() => openAuth("signin")}
                >
                  Entrar na conta
                </button>
                <button
                  className="dv-profile-auth-button dv-profile-auth-secondary"
                  onClick={() => openAuth("signup")}
                >
                  Criar conta grátis
                </button>
              </>
            ) : (
              <button
                className="dv-profile-auth-button dv-profile-auth-secondary"
                onClick={signOut}
              >
                Sair da conta
              </button>
            )}
            <button
              className="dv-profile-item"
              onClick={() => {
                setProfileOpen(false);
                goToPage("perfil");
              }}
            >
              <span>♙</span>
              <span>{tr("Perfil")}</span>
              <b>›</b>
            </button>
            <div className="dv-profile-item dv-language-item">
              <span>🌐</span>
              <span>{tr("Mudança de linguagem")}</span>
              <select
                aria-label="Idioma"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option>Português</option>
                <option>English</option>
                <option>Español</option>
              </select>
            </div>
            <button
              className="dv-profile-item"
              onClick={() => {
                setProfileOpen(false);
                goToPage("historico");
              }}
            >
              <span>◷</span>
              <span>{tr("Veja o histórico")}</span>
              <b>›</b>
            </button>
            <button
              className="dv-profile-item"
              onClick={() => {
                setProfileOpen(false);
                goToPage("favoritos");
              }}
            >
              <span>♡</span>
              <span>{tr("Minha Lista")}</span>
              <b>›</b>
            </button>
            <button className="dv-profile-item" onClick={clearCache}>
              <span>⌫</span>
              <span>{tr("Limpar cache")}</span>
              <b>›</b>
            </button>
            <div className="dv-profile-bottom">
              {user
                ? "Sua conta DRAMOVIX está conectada."
                : tr("Você pode assistir sem criar uma conta.")}
            </div>
          </section>
        </>
      )}
      <main className="dv-main">
        {page === "detalhes" && selectedSeries && (
          <section className="dv-detail">
            <button
              className="dv-back"
              onClick={() => goToPage("filmes")}
            >
              ← {tr("Voltar ao catálogo")}
            </button>
            <div className="dv-detail-header">
              {selectedSeries.image ? (
                <img
                  className="dv-detail-cover"
                  src={selectedSeries.image}
                  alt={selectedSeries.title}
                  onError={hideBrokenImage}
                />
              ) : (
                <div className="dv-detail-cover dv-image-placeholder" />
              )}
              <div className="dv-detail-info">
                <span className="dv-eyebrow">
                  {selectedSeries.category || "SÉRIE"}
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
                      ((selectedSeries.description || "").length > 160
                        ? "..."
                        : "")}
                </p>
                {(selectedSeries.description || "").length > 160 && (
                  <button
                    className="dv-description-toggle"
                    onClick={() => setShowDescription((v) => !v)}
                  >
                    {showDescription
                      ? "Mostrar menos"
                      : "Ler descrição completa"}
                  </button>
                )}
                <div className="dv-detail-actions">
                  <button
                    className="dv-button-primary"
                    onClick={() =>
                      episodes.length && openEpisode(episodes[0])
                    }
                    disabled={episodesLoading || !episodes.length}
                  >
                    {"▶ " + tr("Assistir 1º Episódio")}
                  </button>
                  <button
                    className="dv-description-toggle"
                    onClick={() => toggleFavorite(selectedSeries)}
                  >
                    {isFavorite(selectedSeries)
                      ? "♥ Na minha lista"
                      : "♡ Minha lista"}
                  </button>
                </div>
              </div>
            </div>
            <section className="dv-episodes">
              <div className="dv-section-heading">
                <div>
                  <h2>{tr("Episódios")}</h2>
                  <p>{episodes.length} episódio(s) disponível(is)</p>
                </div>
              </div>
              {episodesLoading ? (
                <p className="dv-message">Carregando episódios...</p>
              ) : episodes.length ? (
                <div className="dv-episode-list">
                  {episodes.map((ep, index) => (
                    <button
                      className="dv-episode"
                      key={ep.id || index}
                      onClick={() => openEpisode(ep)}
                    >
                      <span className="dv-episode-number">
                        {ep.episode_number || index + 1}
                      </span>
                      <span className="dv-episode-info">
                        <strong>
                          {ep.title || `Episódio ${index + 1}`}
                        </strong>
                        <small>
                          {ep.video_url
                            ? tr("Pronto para reprodução")
                            : tr("Em breve")}
                        </small>
                      </span>
                      <span className="dv-episode-play">▶</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="dv-empty">
                  <h3>{tr("Novos episódios em breve")}</h3>
                  <p>
                    {tr(
                      "Estamos preparando os capítulos desta série para você."
                    )}
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
              onClick={() => goToPage("filmes-lista")}
            >
              ← Voltar aos filmes
            </button>
            <div className="dv-detail-header">
              {selectedMovie.image ? (
                <img
                  className="dv-detail-cover"
                  src={selectedMovie.image}
                  alt={selectedMovie.title}
                  onError={hideBrokenImage}
                />
              ) : (
                <div className="dv-detail-cover dv-image-placeholder" />
              )}
              <div className="dv-detail-info">
                <span className="dv-eyebrow">
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
                      ((selectedMovie.description || "").length > 160
                        ? "..."
                        : "")}
                </p>
                {(selectedMovie.description || "").length > 160 && (
                  <button
                    className="dv-description-toggle"
                    onClick={() => setShowDescription((v) => !v)}
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
                    {"▶ " + tr("Assistir filme")}
                  </button>
                  <button
                    className="dv-description-toggle"
                    onClick={() => toggleFavorite(selectedMovie)}
                  >
                    {isFavorite(selectedMovie)
                      ? "♥ Na minha lista"
                      : "♡ Minha lista"}
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
                backgroundImage: heroItem?.image
                  ? `url("${heroItem.image}")`
                  : "none"
              }}
            >
              <div className="dv-hero-overlay" />
              <div className="dv-hero-content">
                <span className="dv-eyebrow">
                  {tr("EM DESTAQUE")}
                </span>
                <h1>{heroItem?.title || "DRAMOVIX"}</h1>
                <p>
                  {heroItem?.description
                    ? heroItem.description.slice(0, 140)
                    : "Sempre tem uma nova história para descobrir."}
                </p>
                <button
                  className="dv-button-primary"
                  onClick={() =>
                    heroItem &&
                    (heroItem.isMovie
                      ? openMovieDetails(heroItem)
                      : openSeries(heroItem))
                  }
                >
                  ▶ {tr("Assistir")}
                </button>
              </div>
            </section>
            <section className="dv-section">
              <div className="dv-section-heading">
                <h2>{tr("Categorias")}</h2>
              </div>
              {renderGenreFilters()}
            </section>
            <section className="dv-section">
              <div className="dv-section-heading">
                <h2>{tr("Continue assistindo")}</h2>
                <button
                  className="dv-see-all"
                  onClick={() => goToPage("historico")}
                >
                  {tr("Ver histórico ›")}
                </button>
              </div>
              {renderGrid(
                watchHistory.slice(0, 4).map((entry) => ({
                  ...entry,
                  id: `history-${entry.id}`,
                  image: entry.image || "",
                  title: entry.contentTitle || entry.title,
                  _history: entry
                })),
                "history"
              )}
            </section>
            <section className="dv-section">
              <div className="dv-section-heading">
                <h2>{tr("Desenhos")}</h2>
                <button
                  className="dv-see-all"
                  onClick={() => goToPage("desenhos")}
                >
                  {tr("Ver todos ›")}
                </button>
              </div>
              {renderGrid(cartoons.slice(0, 4))}
            </section>
            <section className="dv-section">
              <div className="dv-section-heading">
                <h2>{tr("Animes")}</h2>
                <button
                  className="dv-see-all"
                  onClick={() => goToPage("animes")}
                >
                  {tr("Ver todos ›")}
                </button>
              </div>
              {renderGrid(anime.slice(0, 4))}
            </section>
            <section className="dv-section">
              <div className="dv-section-heading">
                <h2>{tr("Filmes")}</h2>
                <button
                  className="dv-see-all"
                  onClick={() => goToPage("filmes-lista")}
                >
                  {tr("Ver todos ›")}
                </button>
              </div>
              {renderGrid(filteredMovies.slice(0, 4), "movie")}
            </section>
            <section className="dv-section">
              <div className="dv-section-heading">
                <h2>{tr("Séries")}</h2>
                <button
                  className="dv-see-all"
                  onClick={() => goToPage("series")}
                >
                  {tr("Ver todos ›")}
                </button>
              </div>
              {renderGrid(ordinarySeries.slice(0, 4))}
            </section>
          </>
        )}
        {page === "filmes-lista" && (
          <section className="dv-section">
            <div className="dv-section-heading">
              <div>
                <h2>{tr("FILMES")}</h2>
                <p>{tr("Filmes disponíveis no catálogo.")}</p>
              </div>
            </div>
            {renderGenreFilters()}
            {renderGrid(filteredMovies, "movie")}
          </section>
        )}
        {page === "series" && (
          <section className="dv-section">
            <div className="dv-section-heading">
              <div>
                <h2>{tr("SÉRIES")}</h2>
                <p>
                  {tr("Maratone as melhores séries e minisséries.")}
                </p>
              </div>
            </div>
            {renderGenreFilters()}
            {renderGrid(ordinarySeries)}
          </section>
        )}
        {page === "desenhos" && (
          <section className="dv-section">
            <div className="dv-section-heading">
              <div>
                <h2>{tr("DESENHOS")}</h2>
                <p>{tr("Desenhos e animações para curtir.")}</p>
              </div>
            </div>
            {renderGenreFilters()}
            {renderGrid(cartoons)}
          </section>
        )}
        {page === "animes" && (
          <section className="dv-section">
            <div className="dv-section-heading">
              <div>
                <h2>ANIME</h2>
                <p>{tr("Animações japonesas.")}</p>
              </div>
            </div>
            {renderGenreFilters()}
            {renderGrid(anime)}
          </section>
        )}
        {page === "doramas" && (
          <section className="dv-section">
            <div className="dv-section-heading">
              <div>
                <h2>DORAMAS</h2>
                <p>{tr("Séries asiáticas de sucesso.")}</p>
              </div>
            </div>
            {renderGenreFilters()}
            {renderGrid(doramas)}
          </section>
        )}
        {page === "tv" && (
          <section className="dv-section">
            <div className="dv-section-heading">
              <div>
                <h2>{tr("TV AO VIVO")}</h2>
                <p>{tr("Assista às transmissões disponíveis.")}</p>
              </div>
            </div>
            {liveChannelsLoading ? (
              <p className="dv-message">Carregando canais ao vivo...</p>
            ) : (
              renderGrid(
                [
                  ...filteredLiveChannels,
                  ...(!search &&
                  !liveChannels.some(
                    (item) => normalize(item.title) === "z nation"
                  )
                    ? [LIVE_SERIES]
                    : [])
                ],
                "live"
              )
            )}
          </section>
        )}
        {page === "explorar" && (
          <section className="dv-section">
            <div className="dv-section-heading">
              <div>
                <h2>{tr("Buscar conteúdo")}</h2>
                <p>
                  {tr(
                    "Pesquise filmes, séries, desenhos, animes e doramas."
                  )}
                </p>
              </div>
            </div>
            <input
              className="dv-search-input"
              type="search"
              placeholder={tr("O que deseja assistir?")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            <h3 className="dv-subheading">{tr("Filmes")}</h3>
            {renderGrid(filteredMovies, "movie")}
            <h3 className="dv-subheading">
              {tr("Séries, desenhos, animes e doramas")}
            </h3>
            {renderGrid(filteredSeries)}
          </section>
        )}
        {page === "favoritos" && (
          <section className="dv-section">
            <div className="dv-section-heading">
              <h2>{tr("Minha Lista")}</h2>
            </div>
            <h3 className="dv-subheading">
              {tr("Séries, desenhos, animes e doramas")}
            </h3>
            {renderGrid(favoriteSeries)}
            <h3 className="dv-subheading">{tr("Filmes")}</h3>
            {renderGrid(favoriteMovies, "movie")}
          </section>
        )}
        {page === "historico" && (
          <section className="dv-section">
            <div className="dv-section-heading">
              <div>
                <h2>{tr("Histórico")}</h2>
                <p>
                  {tr("Conteúdos reproduzidos neste navegador.")}
                </p>
              </div>
              <button
                className="dv-see-all"
                onClick={() => {
                  setWatchHistory([]);
                  localStorage.removeItem("dramovix-history");
                }}
              >
                {tr("Limpar histórico")}
              </button>
            </div>
            {!watchHistory.length ? (
              <div className="dv-empty">
                <span>◷</span>
                <h3>{tr("Seu histórico está vazio")}</h3>
                <p>
                  {tr(
                    "Quando você assistir a algo, aparecerá aqui."
                  )}
                </p>
              </div>
            ) : (
              <div className="dv-history-list">
                {watchHistory.map((entry, i) => (
                  <button
                    className="dv-history-item"
                    key={`${entry.id}-${i}`}
                    onClick={() => {
                      const match =
                        series.find(
                          (item) => item.title === entry.contentTitle
                        ) ||
                        movies.find(
                          (item) => item.title === entry.contentTitle
                        );
                      if (match) {
                        match.isMovie
                          ? openMovieDetails(match)
                          : openSeries(match);
                      }
                    }}
                  >
                    {entry.image ? (
                      <img
                        src={entry.image}
                        alt=""
                        onError={hideBrokenImage}
                      />
                    ) : (
                      <span className="dv-history-placeholder" />
                    )}
                    <span>
                      <strong>
                        {entry.contentTitle || entry.title}
                      </strong>
                      <small>
                        {new Date(entry.watchedAt).toLocaleString()}
                      </small>
                    </span>
                    <b>›</b>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
        {page === "perfil" && (
          <section className="dv-section dv-account-page">
            <div className="dv-section-heading">
              <h2>{tr("Perfil")}</h2>
            </div>
            <div className="dv-account-card">
              <div className="dv-profile-avatar">♙</div>
              <h2>
                {user?.user_metadata?.full_name ||
                  user?.email?.split("@")[0] ||
                  tr("Visitante DRAMOVIX")}
              </h2>
              {user ? (
                <>
                  <p>Conta DRAMOVIX conectada</p>
                  <small>E-mail da conta</small>
                  <strong className="dv-account-email">
                    {user.email}
                  </strong>
                  <button className="dv-button-primary" onClick={signOut}>
                    Sair da conta
                  </button>
                  <p className="dv-muted">
                    Sua conta permite identificar você no DRAMOVIX. Os
                    favoritos e o histórico atuais ainda ficam salvos
                    neste navegador.
                  </p>
                </>
              ) : (
                <>
                  <p>{tr("Você pode assistir sem criar uma conta.")}</p>
                  <small>{tr("Seu ID de visitante")}</small>
                  <strong>{visitorId}</strong>
                  <button
                    className="dv-button-primary"
                    onClick={() => navigator.clipboard?.writeText(visitorId)}
                  >
                    {tr("Copiar ID")}
                  </button>
                  <button
                    className="dv-profile-auth-button"
                    onClick={() => openAuth("signin")}
                  >
                    Entrar na conta
                  </button>
                  <button
                    className="dv-profile-auth-button dv-profile-auth-secondary"
                    onClick={() => openAuth("signup")}
                  >
                    Criar conta grátis
                  </button>
                  <p className="dv-muted">
                    {tr(
                      "O ID fica salvo neste navegador. Para sincronizar seus dados entre dispositivos, futuramente será necessário criar uma conta."
                    )}
                  </p>
                </>
              )}
            </div>
          </section>
        )}
      </main>
      <footer className="dv-footer">
        DRAMOVIX · Sempre tem uma nova história.
      </footer>
      <nav className="dv-bottom-nav" aria-label="Navegação inferior">
        <button
          className={page === "filmes" ? "active" : ""}
          onClick={() => goToPage("filmes")}
        >
          <span>⌂</span>
          <small>{tr("Início")}</small>
        </button>
        <button
          className={page === "filmes-lista" ? "active" : ""}
          onClick={() => goToPage("filmes-lista")}
        >
          <span>▣</span>
          <small>{tr("Filmes")}</small>
        </button>
        <button
          className={page === "explorar" ? "active" : ""}
          onClick={() => {
            setPage("explorar");
            setProfileOpen(false);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <span>⌕</span>
          <small>{tr("Buscar")}</small>
        </button>
        <button
          className={page === "favoritos" ? "active" : ""}
          onClick={() => goToPage("favoritos")}
        >
          <span>♡</span>
          <small>{tr("Minha Lista")}</small>
        </button>
        <button
          className={page === "tv" ? "active" : ""}
          onClick={() => goToPage("tv")}
        >
          <span>◉</span>
          <small>{tr("TV Ao Vivo")}</small>
        </button>
      </nav>
      {playerOpen && (
        <div
          className="dv-player-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closePlayer();
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
                <small>
                  {selectedEpisode?.isLive
                    ? "Ao vivo"
                    : selectedEpisode?.isMovie
                      ? "Filme"
                      : selectedSeries?.title || "DRAMOVIX"}
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
              <div className="dv-player-error" role="alert">
                {playerError}
              </div>
            )}
            {episodeDrawerOpen && episodes.length > 0 && (
              <div className="dv-episode-drawer">
                <div>
                  <strong>{tr("Selecionar episódio")}</strong>
                  <button onClick={() => setEpisodeDrawerOpen(false)}>
                    ✕
                  </button>
                </div>
                {episodes.map((ep, i) => (
                  <button
                    key={ep.id || i}
                    className={
                      String(selectedEpisode?.id) === String(ep.id)
                        ? "selected"
                        : ""
                    }
                    onClick={() => openEpisode(ep)}
                  >
                    Episódio {ep.episode_number || i + 1}:{" "}
                    {ep.title || "Assistir"}
                  </button>
                ))}
              </div>
            )}
            <div className="dv-player-bottom">
              {!selectedEpisode?.isLive &&
              !selectedEpisode?.isMovie &&
              episodes.length > 0 ? (
                <button
                  className="dv-episode-picker"
                  onClick={() => setEpisodeDrawerOpen((v) => !v)}
                >
                  EP.{selectedEpisode?.episode_number || 1} / EP.
                  {episodes.length} {episodeDrawerOpen ? "⌄" : "⌃"}
                </button>
              ) : (
                <span>
                  {selectedEpisode?.isLive
                    ? tr("Transmissão ao vivo")
                    : tr("Filme · DRAMOVIX")}
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
                        (ep) =>
                          String(ep.id) === String(selectedEpisode?.id)
                      ) >=
                        episodes.length - 1
                    }
                  >
                    {tr("Próximo episódio")} →
                  </button>
                )}
            </div>
          </div>
        </div>
      )}
      {authOpen && (
        <div
          className="dv-auth-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setAuthOpen(false);
            }
          }}
        >
          <section
            className="dv-auth-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dv-auth-title"
          >
            <button
              className="dv-auth-close"
              type="button"
              onClick={() => setAuthOpen(false)}
              aria-label="Fechar"
            >
              ×
            </button>
            <div className="dv-auth-brand">DRAMOVIX</div>
            <h2 id="dv-auth-title">
              {authMode === "signup"
                ? "Crie sua conta grátis"
                : "Entre na sua conta"}
            </h2>
            <p className="dv-auth-subtitle">
              {authMode === "signup"
                ? "Crie sua conta para se identificar no DRAMOVIX."
                : "Entre para acessar sua conta DRAMOVIX."}
            </p>
            <form className="dv-auth-form" onSubmit={submitAuth}>
              {authMode === "signup" && (
                <label>
                  Nome
                  <input
                    className="dv-auth-input"
                    type="text"
                    autoComplete="name"
                    value={authName}
                    onChange={(event) => setAuthName(event.target.value)}
                    placeholder="Como podemos te chamar?"
                  />
                </label>
              )}
              <label>
                E-mail
                <input
                  className="dv-auth-input"
                  type="email"
                  autoComplete="email"
                  required
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  placeholder="voce@exemplo.com"
                />
              </label>
              <label>
                Senha
                <input
                  className="dv-auth-input"
                  type="password"
                  autoComplete={
                    authMode === "signup"
                      ? "new-password"
                      : "current-password"
                  }
                  required
                  minLength={6}
                  value={authPassword}
                  onChange={(event) =>
                    setAuthPassword(event.target.value)
                  }
                  placeholder={
                    authMode === "signup"
                      ? "Pelo menos 6 caracteres"
                      : "Sua senha"
                  }
                />
              </label>
              {authError && (
                <p className="dv-auth-error" role="alert">
                  {authError}
                </p>
              )}
              {authMessage && (
                <p className="dv-auth-message" role="status">
                  {authMessage}
                </p>
              )}
              <button
                className="dv-auth-submit"
                type="submit"
                disabled={authBusy}
              >
                {authBusy
                  ? "Aguarde..."
                  : authMode === "signup"
                    ? "Criar conta grátis"
                    : "Entrar"}
              </button>
            </form>
            <div className="dv-auth-switch">
              {authMode === "signup"
                ? "Já tem uma conta?"
                : "Ainda não tem uma conta?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setAuthMode(
                    authMode === "signup" ? "signin" : "signup"
                  );
                  setAuthMessage("");
                  setAuthError("");
                  setAuthPassword("");
                }}
              >
                {authMode === "signup" ? "Entrar" : "Criar conta"}
              </button>
            </div>
            {authMode === "signup" && (
              <small className="dv-auth-terms">
                Ao se cadastrar, você poderá precisar confirmar seu
                e-mail antes de entrar.
              </small>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
