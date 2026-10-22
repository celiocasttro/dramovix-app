import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import Hls from "hls.js";
import "./App.css";
const ZNATION_URL =
  "https://epg.provider.plex.tv/library/parts/646546f35db8ada4c8edd7e5-67d1be3696c7b08c26c19d64.m3u8?includeAllStreams=1&x-plex-product=Plex+Mediaverse&x-plex-token=MZFkHw1Atc9c9bZLRyWw&auto=0";
const LIVE_SERIES = {
  id: "live-znation",
  title: "Z Nation",
  category: "Ao vivo",
  description: "Assista à transmissão de Z Nation.",
  image:
    "https://svinrjrlrlitipleiccb.supabase.co/storage/v1/object/public/dramovix-videos/Capas/Znation.PNG",
  video_url: ZNATION_URL,
  isLive: true
};
const REQUEST_STATUSES = [
  "Recebida",
  "Em andamento",
  "Série postada",
  "Indisponível"
];
function getRequestStatusLabel(status) {
  if (status === "Em busca" || status === "Em preparação") return "Em andamento";
  if (status === "Disponível") return "Série postada";
  return REQUEST_STATUSES.includes(status) ? status : "Recebida";
}
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
function hideBrokenImage(event) {
  const image = event.currentTarget;
  image.onerror = null;
  image.removeAttribute("src");
  image.style.visibility = "hidden";
}
function formatDate(date) {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
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
  const initialUrlParams = new URLSearchParams(window.location.search);
  const sharedRequestId = initialUrlParams.get("solicitacao");
  const sharedSeriesId = initialUrlParams.get("serie");
  const [page, setPage] = useState(() =>
    sharedRequestId ? "solicitacoes" : sharedSeriesId ? "filmes" : "filmes"
  );
  const [profileOpen, setProfileOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [profileSection, setProfileSection] = useState("perfil");
  const [donationOpen, setDonationOpen] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState("");
  const [avatarOptionsOpen, setAvatarOptionsOpen] = useState(false);
  const avatarInputRef = useRef(null);
  const [user, setUser] = useState(null);
  const isDramovixAdmin =
    normalize(user?.email || "") === "celiocastroreal@gmail.com";
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
  const [playlistIndex, setPlaylistIndex] = useState(null);
  const [playlistSelectedCategory, setPlaylistSelectedCategory] = useState(null);
  const [playlistItems, setPlaylistItems] = useState([]);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistError, setPlaylistError] = useState("");
  const [playlistSearch, setPlaylistSearch] = useState("");
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [playerOrientation, setPlayerOrientation] = useState("portrait");
  const [playerError, setPlayerError] = useState("");
  const [showDescription, setShowDescription] = useState(false);
  const [episodeDrawerOpen, setEpisodeDrawerOpen] = useState(false);
  // Solicitações de séries
  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestSearch, setRequestSearch] = useState("");
  const [requestSort, setRequestSort] = useState("recentes");
  const [requestStatusFilter, setRequestStatusFilter] = useState("Todas");
  const [requestFormOpen, setRequestFormOpen] = useState(false);
  const [requestTitle, setRequestTitle] = useState("");
  const [requestCover, setRequestCover] = useState("");
  const [requestLanguage, setRequestLanguage] = useState("Dublado");
  const [requestDescription, setRequestDescription] = useState("");
  const [expandedRequest, setExpandedRequest] = useState(null);
  const [requestComments, setRequestComments] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentsLoading, setCommentsLoading] = useState({});
  const [commentBusy, setCommentBusy] = useState({});
  const [likesBusy, setLikesBusy] = useState({});
  const [requestLikes, setRequestLikes] = useState({});
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const playerGenerationRef = useRef(0);
  const selectedEpisodeRef = useRef(null);
  const advancingEpisodeRef = useRef(false);
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
      "Carregando catálogo…": "Loading catalog…",
      "Sempre tem uma nova história.": "There’s always a new story.",
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
      "Aguarde, carregando episódios…": "Please wait, loading episodes…",
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
      "Carregando catálogo…": "Cargando catálogo…",
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
      "Aguarde, carregando episódios…": "Espera, cargando episodios…",
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
      (_event, session) => setUser(session?.user || null)
    );
    return () => {
      alive = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!sharedSeriesId || loading || !series.length) return;
    const match = series.find((item) =>
      String(item.id) === String(sharedSeriesId) ||
      String(item.dbId ?? "") === String(sharedSeriesId)
    );
    if (match) {
      setSelectedSeries(match);
      setSelectedMovie(null);
      setSelectedEpisode(null);
      setShowDescription(false);
      setPage("detalhes");
      setProfileOpen(false);
    }
  }, [sharedSeriesId, loading, series]);

  useEffect(() => {
    let cancelled = false;
    async function loadPlaylistIndex() {
      try {
        const response = await fetch("/catalogo/filmesseries/data/index.json");
        if (!response.ok) {
          throw new Error("O índice do catálogo ainda não foi gerado pela implantação.");
        }
        const data = await response.json();
        if (!cancelled) setPlaylistIndex(data);
      } catch (error) {
        if (!cancelled) {
          setPlaylistError(
            error?.message || "Não foi possível carregar as categorias do catálogo."
          );
        }
      }
    }
    loadPlaylistIndex();
    return () => {
      cancelled = true;
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
              normalize(item.title) !== normalize("Todo Mundo Odeia o Chris") &&
              !normalize(item.title).includes("tv ao vivo") &&
              !normalize(item.genre || "").includes("tv ao vivo")
          )
          .map((item) => ({
            id: `db-${item.id}`,
            dbId: item.id,
            title: item.title || "Sem título",
            category: item.genre || "Série",
            genre: item.genre || "",
            content_type: item.content_type || "",
            description: item.description || "",
            image: item.cover_url || "",
            isLive: false
          }));
        const loadedMovies = (moviesResult.data || []).map((item) => ({
          id: `movie-${item.id}`,
          dbId: item.id,
          title: item.title || "Sem título",
          category: item.genre || "Filme",
          description: item.description || "",
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
  // Carrega solicitações da comunidade.
  async function loadRequests() {
    setRequestsLoading(true);
    setRequestsError("");
    try {
      const { data, error } = await supabase
        .from("series_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const loadedRequests = data || [];
      setRequests(loadedRequests);
      if (loadedRequests.length) {
        const ids = loadedRequests.map((request) => request.id);
        const { data: likesData, error: likesError } = await supabase
          .from("series_request_likes")
          .select("id, request_id, user_id")
          .in("request_id", ids);
        if (likesError) {
          console.error("Erro ao carregar curtidas:", likesError);
        } else {
          const groupedLikes = {};
          (likesData || []).forEach((like) => {
            if (!groupedLikes[like.request_id]) {
              groupedLikes[like.request_id] = {
                count: 0,
                likedByMe: false
              };
            }
            groupedLikes[like.request_id].count += 1;
            if (user && like.user_id === user.id) {
              groupedLikes[like.request_id].likedByMe = true;
            }
          });
          setRequestLikes(groupedLikes);
        }
      } else {
        setRequestLikes({});
      }
    } catch (error) {
      console.error("Erro ao carregar solicitações:", error);
      setRequestsError(
        user
          ? "Não foi possível carregar as solicitações. Verifique as permissões das tabelas no Supabase."
          : "Entre na sua conta para visualizar as solicitações da comunidade."
      );
      setRequests([]);
    } finally {
      setRequestsLoading(false);
    }
  }
  useEffect(() => {
    if (page === "solicitacoes") {
      loadRequests();
    }
    // loadRequests depende da sessão atual e da página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, user]);
  useEffect(() => {
    if (page !== "solicitacoes" || !expandedRequest) return;
    let cancelled = false;
    async function loadComments() {
      setCommentsLoading((prev) => ({
        ...prev,
        [expandedRequest]: true
      }));
      try {
        const { data, error } = await supabase
          .from("series_request_comments")
          .select("*")
          .eq("request_id", expandedRequest)
          .order("created_at", { ascending: true });
        if (error) throw error;
        if (!cancelled) {
          setRequestComments((prev) => ({
            ...prev,
            [expandedRequest]: data || []
          }));
        }
      } catch (error) {
        console.error("Erro ao carregar comentários:", error);
        if (!cancelled) {
          setRequestComments((prev) => ({
            ...prev,
            [expandedRequest]: []
          }));
        }
      } finally {
        if (!cancelled) {
          setCommentsLoading((prev) => ({
            ...prev,
            [expandedRequest]: false
          }));
        }
      }
    }
    loadComments();
    return () => {
      cancelled = true;
    };
  }, [page, expandedRequest]);
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
          .order("season_number", { ascending: true })
          .order("episode_number", { ascending: true });
        if (error) throw error;
        if (!cancelled) {
          setEpisodes(
            (data || []).map((ep) => ({
              ...ep,
              title: ep.title || `Episódio ${ep.episode_number || ""}`.trim(),
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
  /*
   * PLAYER:
   * - Carrega o vídeo ao abrir um episódio.
   * - Tenta iniciar a reprodução automaticamente.
   * - Usa HLS.js para links .m3u8.
   * - Avança automaticamente para o próximo episódio ao terminar.
   * - Impede eventos de vídeos antigos de afetarem o episódio atual.
   */
  useEffect(() => {
    if (!playerOpen || !selectedEpisode || !videoRef.current) return;
    const video = videoRef.current;
    const url = selectedEpisode.video_url || "";
    setPlayerOrientation(
      selectedEpisode.isMovie || selectedEpisode.isLive || selectedSeries?.isLive
        ? "landscape"
        : "portrait"
    );
    const generation = ++playerGenerationRef.current;
    let cancelled = false;
    let hls = null;
    let autoplayTimer = null;
    let nativeFallbackAttempted = false;
    selectedEpisodeRef.current = selectedEpisode;
    advancingEpisodeRef.current = false;
    setPlayerError("");
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    video.pause();
    video.removeAttribute("src");
    video.load();
    if (!url) {
      setPlayerError("Este conteúdo ainda não possui um link de vídeo.");
      return () => {
        cancelled = true;
      };
    }
    const isCurrentPlayer = () =>
      !cancelled && generation === playerGenerationRef.current;
    const handleVideoError = () => {
      if (!isCurrentPlayer()) return;
      setPlayerError(
        "Não foi possível reproduzir este vídeo. O link pode ter expirado ou o servidor pode bloquear a reprodução."
      );
    };
    const attemptAutoplay = () => {
      if (!isCurrentPlayer()) return;
      if (video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
        return;
      }
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch((error) => {
          console.warn(
            "Reprodução automática bloqueada pelo navegador:",
            error
          );
        });
      }
    };
    const scheduleAutoplay = () => {
      if (!isCurrentPlayer()) return;
      window.clearTimeout(autoplayTimer);
      autoplayTimer = window.setTimeout(attemptAutoplay, 100);
    };
    const handleVideoMetadata = () => {
      if (!isCurrentPlayer()) return;
      const { videoWidth, videoHeight } = video;
      if (videoWidth > 0 && videoHeight > 0) {
        setPlayerOrientation(videoWidth >= videoHeight ? "landscape" : "portrait");
      }
    };
    const handlePlaying = () => {
      if (isCurrentPlayer()) setPlayerError("");
    };
    video.autoplay = true;
    video.preload = "auto";
    video.addEventListener("error", handleVideoError);
    video.addEventListener("loadedmetadata", handleVideoMetadata);
    video.addEventListener("loadedmetadata", scheduleAutoplay);
    video.addEventListener("canplay", scheduleAutoplay);
    video.addEventListener("playing", handlePlaying);
    const isHls = /\.m3u8(?:$|[?#])/i.test(url);
    const nativeHlsSupported = Boolean(
      video.canPlayType("application/vnd.apple.mpegurl")
    );
    // No Safari/iOS moderno, prioriza o HLS nativo quando há Managed Media Source.
    // Isso pode evitar falhas de CORS que ocorrem ao buscar cada segmento via HLS.js.
    const preferNativeHls =
      isHls && nativeHlsSupported && "ManagedMediaSource" in window;
    if (preferNativeHls) {
      video.src = url;
      video.load();
      scheduleAutoplay();
    } else if (isHls && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
        manifestLoadingTimeOut: 20000,
        levelLoadingTimeOut: 20000,
        fragLoadingTimeOut: 30000
      });
      hlsRef.current = hls;
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        if (isCurrentPlayer()) {
          hls.loadSource(url);
        }
      });
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        scheduleAutoplay();
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!isCurrentPlayer()) return;
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            // Tenta o player HLS nativo quando o servidor bloqueia requisições via HLS.js.
            if (
              !nativeFallbackAttempted &&
              video.canPlayType("application/vnd.apple.mpegurl")
            ) {
              nativeFallbackAttempted = true;
              hls.destroy();
              if (hlsRef.current === hls) hlsRef.current = null;
              hls = null;
              video.src = url;
              video.load();
              scheduleAutoplay();
            } else {
              setPlayerError(
                "Não foi possível carregar o vídeo. O link pode ter expirado ou o servidor pode estar indisponível."
              );
              hls.startLoad();
            }
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            setPlayerError(
              "Não foi possível reproduzir este vídeo neste navegador."
            );
            hls.destroy();
          }
        }
      });
      hls.attachMedia(video);
    } else if (!isHls || nativeHlsSupported) {
      video.src = url;
      video.load();
      scheduleAutoplay();
    } else {
      setPlayerError("Este navegador não oferece suporte à reprodução HLS deste vídeo.");
    }
    return () => {
      cancelled = true;
      window.clearTimeout(autoplayTimer);
      video.removeEventListener("error", handleVideoError);
      video.removeEventListener("loadedmetadata", handleVideoMetadata);
      video.removeEventListener("loadedmetadata", scheduleAutoplay);
      video.removeEventListener("canplay", scheduleAutoplay);
      video.removeEventListener("playing", handlePlaying);
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
  // Destaque exclusivo para TV ao Vivo, separado do destaque principal.
  const liveHeroItem = liveChannels.find((item) => item.video_url || item.isLive) || LIVE_SERIES;
  const isLandscapePlayer = playerOrientation === "landscape";
  const filteredRequests = requests
    .filter((request) => {
      const query = normalize(requestSearch);
      const matchesQuery =
        !query ||
        normalize(request.title).includes(query) ||
        normalize(request.description || "").includes(query);
      const matchesStatus =
        requestStatusFilter === "Todas" ||
        getRequestStatusLabel(request.status) === requestStatusFilter;
      return matchesQuery && matchesStatus;
    })
    .sort((a, b) => {
      if (requestSort === "curtidas") {
        return (
          (requestLikes[b.id]?.count || 0) -
          (requestLikes[a.id]?.count || 0)
        );
      }
      if (requestSort === "antigas") {
        return new Date(a.created_at) - new Date(b.created_at);
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });
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
    const url = new URL(window.location.href);
    url.searchParams.delete("solicitacao");
    url.searchParams.set("serie", String(item.id));
    window.history.replaceState({}, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function shareSeries(item) {
    if (!item) return;
    const shareUrl = new URL(window.location.origin + window.location.pathname);
    shareUrl.searchParams.set("serie", String(item.id));
    const shareText = `Confira "${item.title}" no DRAMOVIX!`;
    try {
      if (navigator.share) {
        await navigator.share({ title: item.title, text: shareText, url: shareUrl.toString() });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${shareText} ${shareUrl.toString()}`);
        window.alert("Link da série copiado! Agora é só compartilhar.");
      } else {
        window.prompt("Copie o link para compartilhar esta série:", shareUrl.toString());
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        window.prompt("Copie o link para compartilhar esta série:", shareUrl.toString());
      }
    }
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
    if (!episode) return;
    advancingEpisodeRef.current = false;
    selectedEpisodeRef.current = episode;
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
  async function playEpisode(episode) {
    if (!episode) return;
    if (!episode.id) {
      window.alert("Não foi possível identificar este episódio no catálogo.");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke(
        "resolve-episode-playback",
        { body: { episode_id: episode.id } }
      );

      if (error || !data?.url) {
        console.error("Falha ao resolver link do episódio:", error || data);
        advancingEpisodeRef.current = false;
        window.alert(
          data?.error ||
            "Não foi possível preparar este episódio agora. Tente novamente."
        );
        return;
      }

      openPlayer({ ...episode, video_url: data.url });
    } catch (error) {
      console.error("Erro ao solicitar link do episódio:", error);
      advancingEpisodeRef.current = false;
      window.alert(
        "Não foi possível preparar este episódio agora. Verifique sua conexão e tente novamente."
      );
    }
  }

  function openEpisode(episode) {
    return playEpisode(episode);
  }
  async function playMovie(movie) {
    if (!movie) return;
    if (!movie.dbId) {
      window.alert("Não foi possível identificar este filme no catálogo.");
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("resolve-movie-playback", {
        body: { movie_id: movie.dbId }
      });
      if (error || !data?.url) {
        console.error("Falha ao resolver link de reprodução:", error || data);
        window.alert(data?.error || "Não foi possível preparar o vídeo agora. Tente novamente.");
        return;
      }
      openPlayer({
        id: movie.id,
        title: movie.title,
        video_url: data.url,
        isMovie: true
      });
    } catch (error) {
      console.error("Erro ao solicitar link de reprodução:", error);
      window.alert("Não foi possível preparar o vídeo agora. Verifique sua conexão e tente novamente.");
    }
  }
  function openLive(item) {
    setSelectedSeries(item);
    setSelectedMovie(null);
    openPlayer({
      id: `${item.id}-stream`,
      title: item.title,
      video_url: item.video_url,
      isLive: true
    });
  }
  function closePlayer() {
    playerGenerationRef.current += 1;
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }
    selectedEpisodeRef.current = null;
    advancingEpisodeRef.current = false;
    setPlayerOpen(false);
    setSelectedEpisode(null);
    setPlayerError("");
    setEpisodeDrawerOpen(false);
  }
  function playNextEpisode() {
    const currentEpisode = selectedEpisodeRef.current || selectedEpisode;
    if (!currentEpisode || currentEpisode.isLive || currentEpisode.isMovie) {
      return;
    }
    if (!episodes.length) return;
    const index = episodes.findIndex(
      (ep) => String(ep.id) === String(currentEpisode.id)
    );
    if (index >= 0 && index < episodes.length - 1) {
      advancingEpisodeRef.current = true;
      playEpisode(episodes[index + 1]);
    }
  }
  function handleVideoEnded() {
    if (advancingEpisodeRef.current) return;
    const currentEpisode = selectedEpisodeRef.current || selectedEpisode;
    if (!currentEpisode || currentEpisode.isLive || currentEpisode.isMovie) {
      return;
    }
    const index = episodes.findIndex(
      (ep) => String(ep.id) === String(currentEpisode.id)
    );
    if (index >= 0 && index < episodes.length - 1) {
      advancingEpisodeRef.current = true;
      playEpisode(episodes[index + 1]);
    }
  }
  function goToPage(nextPage) {
    setPage(nextPage);
    if (["filmes-lista", "filmes", "series"].includes(nextPage)) {
      setPlaylistSelectedCategory(null);
      setPlaylistItems([]);
      setPlaylistSearch("");
      setPlaylistError("");
    }
    if (
      [
        "filmes",
        "filmes-lista",
        "desenhos",
        "animes",
        "doramas",
        "tv"
      ].includes(nextPage)
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
          setAuthMessage("Conta criada com sucesso! Você já está conectado.");
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
  async function handleAvatarUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!user || !file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarMessage("Escolha um arquivo de imagem.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarMessage("A foto deve ter no máximo 5 MB.");
      return;
    }
    setAvatarBusy(true);
    setAvatarMessage("");
    try {
      const extension = (file.name.split(".").pop() || "jpg")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "") || "jpg";
      const filePath = `${user.id}/avatar.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type,
          cacheControl: "3600"
        });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage
        .from("profile-photos")
        .getPublicUrl(filePath);
      const avatarUrl = `${publicData.publicUrl}?v=${Date.now()}`;
      const { data, error } = await supabase.auth.updateUser({
        data: { avatar_url: avatarUrl }
      });
      if (error) throw error;
      setUser(data.user || { ...user, user_metadata: { ...user.user_metadata, avatar_url: avatarUrl } });
      setAvatarMessage("Foto de perfil atualizada!");
    } catch (error) {
      console.error("Erro ao atualizar foto de perfil:", error);
      setAvatarMessage(
        error?.message?.includes("Bucket not found")
          ? "O armazenamento das fotos ainda não foi configurado no Supabase."
          : error?.message || "Não foi possível atualizar a foto."
      );
    } finally {
      setAvatarBusy(false);
    }
  }
  async function removeAvatar() {
    if (!user) return;
    setAvatarBusy(true);
    setAvatarMessage("");
    try {
      const { error } = await supabase.auth.updateUser({
        data: { avatar_url: null }
      });
      if (error) throw error;
      setUser({
        ...user,
        user_metadata: { ...user.user_metadata, avatar_url: null }
      });
      setAvatarMessage("Foto removida. O avatar padrão foi restaurado.");
    } catch (error) {
      setAvatarMessage(error?.message || "Não foi possível remover a foto.");
    } finally {
      setAvatarBusy(false);
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
  // Abre a área de solicitações e atualiza os dados.
  function openRequestsPage() {
    setPage("solicitacoes");
    setSelectedSeries(null);
    setSelectedMovie(null);
    setSelectedEpisode(null);
    setSearch("");
    setProfileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function openRequestForm() {
    if (!user) {
      openAuth("signin");
      setAuthMessage(
        "Entre na sua conta para solicitar uma série e participar da comunidade."
      );
      return;
    }
    setRequestTitle("");
    setRequestCover("");
    setRequestLanguage("Dublado");
    setRequestDescription("");
    setRequestMessage("");
    setRequestFormOpen(true);
  }
  async function submitSeriesRequest(event) {
    event.preventDefault();
    if (!user) {
      setRequestMessage("Entre na sua conta para enviar uma solicitação.");
      return;
    }
    const title = requestTitle.trim();
    if (title.length < 2) {
      setRequestMessage("Digite o nome da série que deseja solicitar.");
      return;
    }
    if (title.length > 150) {
      setRequestMessage("O nome da série deve ter no máximo 150 caracteres.");
      return;
    }
    if (
      requestCover.trim() &&
      !/^https?:\/\//i.test(requestCover.trim())
    ) {
      setRequestMessage("O link da capa precisa começar com http:// ou https://.");
      return;
    }
    setRequestBusy(true);
    setRequestMessage("");
    try {
      const { data, error } = await supabase
        .from("series_requests")
        .insert({
          user_id: user.id,
          title,
          cover_url: requestCover.trim() || null,
          language: requestLanguage,
          description: requestDescription.trim() || null
        })
        .select()
        .single();
      if (error) throw error;
      setRequests((prev) => [data, ...prev]);
      setRequestLikes((prev) => ({
        ...prev,
        [data.id]: { count: 0, likedByMe: false }
      }));
      setRequestFormOpen(false);
      setRequestMessage("Solicitação enviada com sucesso!");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("Erro ao enviar solicitação:", error);
      setRequestMessage(
        error?.message ||
          "Não foi possível enviar sua solicitação. Tente novamente."
      );
    } finally {
      setRequestBusy(false);
    }
  }
  async function toggleRequestLike(request) {
    if (!user) {
      openAuth("signin");
      return;
    }
    if (likesBusy[request.id]) return;
    setLikesBusy((prev) => ({ ...prev, [request.id]: true }));
    const current = requestLikes[request.id] || {
      count: 0,
      likedByMe: false
    };
    try {
      if (current.likedByMe) {
        const { error } = await supabase
          .from("series_request_likes")
          .delete()
          .eq("request_id", request.id)
          .eq("user_id", user.id);
        if (error) throw error;
        setRequestLikes((prev) => ({
          ...prev,
          [request.id]: {
            count: Math.max(0, (prev[request.id]?.count || 0) - 1),
            likedByMe: false
          }
        }));
      } else {
        const { error } = await supabase
          .from("series_request_likes")
          .insert({
            request_id: request.id,
            user_id: user.id
          });
        if (error) {
          // Trata o caso de a mesma pessoa clicar duas vezes.
          if (error.code === "23505") {
            await loadRequests();
            return;
          }
          throw error;
        }
        setRequestLikes((prev) => ({
          ...prev,
          [request.id]: {
            count: (prev[request.id]?.count || 0) + 1,
            likedByMe: true
          }
        }));
      }
    } catch (error) {
      console.error("Erro ao atualizar curtida:", error);
      window.alert(
        "Não foi possível atualizar a curtida. Confira sua conexão e tente novamente."
      );
    } finally {
      setLikesBusy((prev) => ({ ...prev, [request.id]: false }));
    }
  }
  async function deleteRequest(request) {
    if (!isDramovixAdmin) {
      window.alert("Você não tem permissão para excluir solicitações.");
      return;
    }

    const confirmed = window.confirm(
      `Tem certeza que deseja excluir a solicitação "${request.title}"? Essa ação não pode ser desfeita e removerá também os comentários e curtidas desse pedido.`
    );
    if (!confirmed) return;

    try {
      const { error: commentsError } = await supabase
        .from("series_request_comments")
        .delete()
        .eq("request_id", request.id);
      if (commentsError) throw commentsError;

      const { error: likesError } = await supabase
        .from("series_request_likes")
        .delete()
        .eq("request_id", request.id);
      if (likesError) throw likesError;

      const { error: requestError } = await supabase
        .from("series_requests")
        .delete()
        .eq("id", request.id);
      if (requestError) throw requestError;

      setRequests((previous) => previous.filter((item) => item.id !== request.id));
      setRequestComments((previous) => {
        const next = { ...previous };
        delete next[request.id];
        return next;
      });
      setRequestLikes((previous) => {
        const next = { ...previous };
        delete next[request.id];
        return next;
      });
      setRequestMessage(`A solicitação "${request.title}" foi excluída.`);
    } catch (error) {
      console.error("Erro ao excluir solicitação:", error);
      window.alert(
        `Não foi possível excluir a solicitação. Verifique as permissões de exclusão no Supabase. Detalhes: ${error?.message || "erro desconhecido"}`
      );
    }
  }

  async function updateRequestStatus(request, newStatus) {
    if (!isDramovixAdmin) {
      window.alert("Você não tem permissão para alterar esta solicitação.");
      return;
    }
    if (!REQUEST_STATUSES.includes(newStatus)) {
      window.alert("Status inválido.");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("series_requests")
        .update({ status: newStatus })
        .eq("id", request.id)
        .select()
        .single();

      if (error) throw error;

      setRequests((previous) =>
        previous.map((item) =>
          item.id === request.id ? { ...item, ...data } : item
        )
      );
      setRequestMessage(
        `Status de "${request.title}" atualizado para "${newStatus}".`
      );
    } catch (error) {
      console.error("Erro ao alterar status da solicitação:", error);
      window.alert(
        `Não foi possível alterar o status: ${error?.message || "erro desconhecido"}`
      );
    }
  }

  async function submitRequestComment(event, request) {
    event.preventDefault();
    if (!user) {
      openAuth("signin");
      return;
    }
    const content = (commentDrafts[request.id] || "").trim();
    if (!content) return;
    if (content.length > 1000) {
      window.alert("O comentário deve ter no máximo 1.000 caracteres.");
      return;
    }
    setCommentBusy((prev) => ({ ...prev, [request.id]: true }));
    try {
      const { data, error } = await supabase
        .from("series_request_comments")
        .insert({
          request_id: request.id,
          user_id: user.id,
          author_name:
            user.user_metadata?.full_name?.trim() ||
            user.email?.split("@")[0] ||
            "Membro DRAMOVIX",
          author_avatar_url: user.user_metadata?.avatar_url || null,
          content
        })
        .select()
        .single();
      if (error) throw error;
      setRequestComments((prev) => ({
        ...prev,
        [request.id]: [...(prev[request.id] || []), data]
      }));
      setCommentDrafts((prev) => ({
        ...prev,
        [request.id]: ""
      }));
    } catch (error) {
      console.error("Erro ao enviar comentário:", error);
      window.alert(
        "Não foi possível publicar o comentário. Tente novamente."
      );
    } finally {
      setCommentBusy((prev) => ({ ...prev, [request.id]: false }));
    }
  }
  async function deleteRequestComment(comment, requestId) {
    if (!user || comment.user_id !== user.id) return;
    const confirmed = window.confirm("Deseja apagar este comentário?");
    if (!confirmed) return;
    try {
      const { error } = await supabase
        .from("series_request_comments")
        .delete()
        .eq("id", comment.id)
        .eq("user_id", user.id);
      if (error) throw error;
      setRequestComments((prev) => ({
        ...prev,
        [requestId]: (prev[requestId] || []).filter(
          (item) => item.id !== comment.id
        )
      }));
    } catch (error) {
      console.error("Erro ao excluir comentário:", error);
      window.alert("Não foi possível excluir o comentário.");
    }
  }
  async function openPlaylistCategory(category) {
    setPlaylistSelectedCategory(category);
    setPlaylistItems([]);
    setPlaylistSearch("");
    setPlaylistError("");
    setPlaylistLoading(true);
    try {
      const response = await fetch(
        `/catalogo/filmesseries/data/${encodeURIComponent(category.file)}`
      );
      if (!response.ok) {
        throw new Error("Não foi possível abrir esta categoria. Tente novamente.");
      }
      const items = await response.json();
      setPlaylistItems(Array.isArray(items) ? items : []);
    } catch (error) {
      setPlaylistError(error?.message || "Falha ao carregar os títulos desta categoria.");
    } finally {
      setPlaylistLoading(false);
    }
  }

  function openPlaylistItem(item) {
    if (!item?.videoUrl) {
      window.alert("Este título não possui um link de vídeo disponível.");
      return;
    }
    setSelectedSeries(null);
    setSelectedMovie(null);
    openPlayer({
      id: item.id,
      title: item.title,
      video_url: item.videoUrl,
      isMovie: true,
      image: item.cover || ""
    });
  }

  function renderPlaylistCatalog(typeFilter = "all") {
    const allCategories = playlistIndex?.categories || [];
    const categories = allCategories.filter((category) => {
      if (typeFilter === "movies") return category.type === "movies" || category.type === "other";
      if (typeFilter === "series") return category.type === "series";
      return true;
    });
    const groups = [
      ...(typeFilter !== "series" ? [{ key: "movies", title: "FILMES" }] : []),
      ...(typeFilter !== "movies" ? [{ key: "series", title: "SÉRIES" }] : []),
      ...(typeFilter !== "series" ? [{ key: "other", title: "OUTRAS CATEGORIAS" }] : [])
    ];
    const visibleItems = playlistItems.filter((item) =>
      normalize(item.title).includes(normalize(playlistSearch))
    );

    return (
      <section className="dv-section dv-iptv-catalog">
        <div className="dv-section-heading">
          <div>
            <span className="dv-eyebrow">CATÁLOGO COMPLETO</span>
            <h2>{typeFilter === "series" ? "Séries por categoria" : typeFilter === "movies" ? "Filmes por categoria" : "Filmes e séries por categoria"}</h2>
            <p>
              {playlistIndex
                ? `${categories.reduce((sum, category) => sum + Number(category.count || 0), 0).toLocaleString("pt-BR")} títulos · ${categories.length} categorias`
                : "Carregando as categorias do arquivo IPTV..."}
            </p>
          </div>
          {playlistSelectedCategory && (
            <button
              className="dv-see-all"
              onClick={() => {
                setPlaylistSelectedCategory(null);
                setPlaylistItems([]);
                setPlaylistSearch("");
                setPlaylistError("");
              }}
            >
              ← Todas as categorias
            </button>
          )}
        </div>

        {playlistError && !playlistSelectedCategory && !playlistIndex && (
          <div className="dv-message">{playlistError}</div>
        )}

        {!playlistSelectedCategory && (
          <div className="dv-iptv-groups">
            {groups.map((group) => {
              const groupCategories = categories.filter(
                (category) => category.type === group.key
              );
              if (!groupCategories.length) return null;
              return (
                <div className="dv-iptv-group" key={group.key}>
                  <div className="dv-iptv-group-heading">
                    <h3>{group.title}</h3>
                    <span>{groupCategories.length} categorias</span>
                  </div>
                  <div className="dv-iptv-category-grid">
                    {groupCategories.map((category) => (
                      <button
                        className="dv-iptv-category"
                        key={category.slug}
                        onClick={() => openPlaylistCategory(category)}
                      >
                        <span className="dv-iptv-category-icon">▤</span>
                        <span className="dv-iptv-category-name">{category.name}</span>
                        <strong>{Number(category.count || 0).toLocaleString("pt-BR")}</strong>
                        <small>títulos</small>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {playlistSelectedCategory && (
          <>
            <div className="dv-iptv-selected-heading">
              <div>
                <h3>{playlistSelectedCategory.name}</h3>
                <p>
                  {Number(playlistSelectedCategory.count || 0).toLocaleString("pt-BR")} títulos nesta categoria
                </p>
              </div>
              <input
                className="dv-iptv-search"
                type="search"
                value={playlistSearch}
                onChange={(event) => setPlaylistSearch(event.target.value)}
                placeholder="Buscar título nesta categoria"
                aria-label="Buscar título nesta categoria"
              />
            </div>
            {playlistLoading ? (
              <p className="dv-message">Carregando títulos desta categoria…</p>
            ) : playlistError ? (
              <p className="dv-message">{playlistError}</p>
            ) : visibleItems.length ? (
              <div className="dv-grid">
                {visibleItems.map((item) => (
                  <article className="dv-card" key={item.id}>
                    <button
                      className="dv-card-image-button"
                      onClick={() => openPlaylistItem(item)}
                      aria-label={`Reproduzir ${item.title}`}
                    >
                      {item.cover ? (
                        <img
                          className="dv-card-image"
                          src={item.cover}
                          alt={item.title}
                          loading="lazy"
                          onError={hideBrokenImage}
                        />
                      ) : (
                        <span className="dv-card-image dv-image-placeholder" />
                      )}
                    </button>
                    <div className="dv-card-content">
                      <h3
                        onClick={() => openPlaylistItem(item)}
                        title={item.title}
                      >
                        {item.title}
                      </h3>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="dv-empty">
                <span>✦</span>
                <h3>Nenhum título encontrado</h3>
                <p>Tente mudar o termo de busca.</p>
              </div>
            )}
          </>
        )}
      </section>
    );
  }

  function renderGenreFilters() {
    return (
      <div className="dv-genre-filters">
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
            (entry) => entry.title === (item.contentTitle || item.title)
          ) ||
          movies.find(
            (entry) => entry.title === (item.contentTitle || item.title)
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
          {type === "live" && <span className="dv-live-badge">AO VIVO</span>}
          {isFavorite(item) && <span className="dv-favorite-badge">♥</span>}
        </button>
        <div className="dv-card-content">
          <h3 onClick={openItem} title={item.title}>
            {item.title}
          </h3>
          {page === "favoritos" && (
            <small className="dv-card-category">{favoriteTypeLabel}</small>
          )}
        </div>
      </article>
    );
  }
  function renderGrid(items, type = "series") {
    if (loading && type !== "live") {
      return <p className="dv-message">{tr("Carregando catálogo…")}</p>;
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
  function renderRequestStatus(status) {
    const label = getRequestStatusLabel(status);
    const statusClasses = {
      Recebida: "dv-request-status--received",
      "Em andamento": "dv-request-status--searching",
      "Série postada": "dv-request-status--available",
      Indisponível: "dv-request-status--unavailable"
    };
    return (
      <span
        className={`dv-request-status ${
          statusClasses[label] || ""
        }`}
      >
        {label}
      </span>
    );
  }
  useEffect(() => {
    if (!sharedRequestId || page !== "solicitacoes" || requestsLoading) return;
    const targetRequest = requests.find(
      (request) => String(request.id) === String(sharedRequestId)
    );
    if (!targetRequest) return;
    setExpandedRequest(targetRequest.id);
    const timer = window.setTimeout(() => {
      document.getElementById(`solicitacao-${sharedRequestId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [sharedRequestId, page, requests, requestsLoading]);

  function renderRequestsPage() {
    return (
      <section className="dv-section dv-requests-page">
        <div className="dv-section-heading dv-requests-heading">
          <div>
            <span className="dv-eyebrow">COMUNIDADE DRAMOVIX</span>
            <h2>Solicitar séries</h2>
            <p>
              Peça uma série que ainda não está no catálogo e acompanhe os
              pedidos da comunidade.
            </p>
          </div>
          <button
            className="dv-button-primary"
            onClick={openRequestForm}
          >
            + Solicitar série
          </button>
        </div>
        <div className="dv-requests-info">
          <span>🎬</span>
          <div>
            <strong>Qual série você quer ver no DRAMOVIX?</strong>
            <p>
              Envie sua sugestão, curta os pedidos de outras pessoas e deixe
              comentários para ajudar a comunidade.
            </p>
          </div>
        </div>
        {!user && (
          <div className="dv-request-login-notice">
            <p>
              Você pode assistir ao catálogo como visitante. Para enviar
              solicitações, curtir pedidos e comentar, entre na sua conta.
            </p>
            <button
              className="dv-button-primary"
              onClick={() => openAuth("signin")}
            >
              Entrar ou criar conta grátis
            </button>
          </div>
        )}
        {requestMessage && (
          <div className="dv-request-feedback" role="status">
            {requestMessage}
            <button
              type="button"
              onClick={() => setRequestMessage("")}
              aria-label="Fechar mensagem"
            >
              ×
            </button>
          </div>
        )}
        <div className="dv-request-toolbar">
          <input
            type="search"
            className="dv-search-input"
            placeholder="Buscar uma série solicitada..."
            value={requestSearch}
            onChange={(event) => setRequestSearch(event.target.value)}
          />
          <select
            value={requestStatusFilter}
            onChange={(event) => setRequestStatusFilter(event.target.value)}
            aria-label="Filtrar por status"
          >
            <option value="Todas">Todos os status</option>
            {REQUEST_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select
            value={requestSort}
            onChange={(event) => setRequestSort(event.target.value)}
            aria-label="Ordenar solicitações"
          >
            <option value="recentes">Mais recentes</option>
            <option value="antigas">Mais antigas</option>
            <option value="curtidas">Mais curtidas</option>
          </select>
        </div>
        {requestsLoading ? (
          <p className="dv-message">Carregando solicitações...</p>
        ) : requestsError ? (
          <div className="dv-empty dv-request-error">
            <span>✦</span>
            <h3>Solicitações da comunidade</h3>
            <p>{requestsError}</p>
            {user && (
              <button
                className="dv-button-primary"
                onClick={loadRequests}
              >
                Tentar novamente
              </button>
            )}
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="dv-empty">
            <span>🎬</span>
            <h3>Nenhuma solicitação encontrada</h3>
            <p>
              Ainda não encontrou essa série por aqui? Seja a primeira pessoa
              a solicitar!
            </p>
            <button
              className="dv-button-primary"
              onClick={openRequestForm}
            >
              + Solicitar série
            </button>
          </div>
        ) : (
          <div className="dv-request-list">
            {filteredRequests.map((request) => {
              const likes = requestLikes[request.id] || {
                count: 0,
                likedByMe: false
              };
              const comments = requestComments[request.id] || [];
              const isExpanded = expandedRequest === request.id;
              return (
                <article
                  className="dv-request-card"
                  id={`solicitacao-${request.id}`}
                  key={request.id}
                >
                  <div className="dv-request-card-main">
                    {request.cover_url ? (
                      <img
                        className="dv-request-cover"
                        src={request.cover_url}
                        alt={`Capa de ${request.title}`}
                        loading="lazy"
                        onError={hideBrokenImage}
                      />
                    ) : (
                      <div className="dv-request-cover dv-image-placeholder">
                        🎬
                      </div>
                    )}
                    <div className="dv-request-content">
                      <div className="dv-request-card-top">
                        {renderRequestStatus(request.status)}
                        <small>{formatDate(request.created_at)}</small>
                      </div>
                      <h3>{request.title}</h3>
                      <div className="dv-request-tags">
                        <span>
                          {request.language || "Dublado"}
                        </span>
                      </div>
                      {request.description && (
                        <p className="dv-request-description">
                          {request.description}
                        </p>
                      )}
                      {isDramovixAdmin && (
                        <div
                          className="dv-admin-request-status"
                          style={{
                            margin: "12px 0",
                            padding: "12px",
                            borderRadius: "10px",
                            background: "rgba(255, 255, 255, 0.06)"
                          }}
                        >
                          <label
                            htmlFor={`dramovix-admin-status-${request.id}`}
                            style={{
                              display: "block",
                              marginBottom: "8px",
                              fontWeight: 600
                            }}
                          >
                            🛠️ Administrador — alterar status
                          </label>
                          <select
                            id={`dramovix-admin-status-${request.id}`}
                            value={getRequestStatusLabel(request.status)}
                            onChange={(event) =>
                              updateRequestStatus(request, event.target.value)
                            }
                            style={{
                              width: "100%",
                              padding: "10px",
                              borderRadius: "8px",
                              border: "1px solid rgba(255,255,255,0.2)",
                              background: "#171717",
                              color: "#ffffff"
                            }}
                          >
                            {REQUEST_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className="dv-request-actions">
                        {isDramovixAdmin && (
                          <button
                            type="button"
                            className="dv-request-delete-comment"
                            onClick={() => deleteRequest(request)}
                            style={{
                              border: "1px solid rgba(255, 90, 90, 0.45)",
                              borderRadius: "8px",
                              padding: "9px 12px",
                              background: "rgba(180, 30, 30, 0.14)",
                              color: "#ff8f8f",
                              cursor: "pointer"
                            }}
                          >
                            🗑️ Excluir solicitação
                          </button>
                        )}
                        <button
                          type="button"
                          className={`dv-request-like ${
                            likes.likedByMe ? "active" : ""
                          }`}
                          disabled={Boolean(likesBusy[request.id])}
                          onClick={() => toggleRequestLike(request)}
                        >
                          {likes.likedByMe ? "♥ Curtido" : "♡ Curtir"}
                          <span>{likes.count}</span>
                        </button>
                        <button
                          type="button"
                          className="dv-request-comment-toggle"
                          onClick={() =>
                            setExpandedRequest((current) =>
                              current === request.id ? null : request.id
                            )
                          }
                        >
                          💬 Comentários ({comments.length})
                        </button>
                        <button
                          type="button"
                          className="dv-request-share"
                          onClick={async () => {
                            const shareUrl = `${window.location.origin}/?pagina=solicitacoes&solicitacao=${encodeURIComponent(request.id)}`;
                            const shareText = `Confira a solicitação da série "${request.title}" no DRAMOVIX! Acesse o link para encontrar este pedido no DRAMOVIX:`;
                            try {
                              if (navigator.share) {
                                await navigator.share({
                                  title: "DRAMOVIX",
                                  text: shareText,
                                  url: shareUrl
                                });
                              } else if (navigator.clipboard) {
                                await navigator.clipboard.writeText(
                                  `${shareText} ${shareUrl}`
                                );
                                window.alert(
                                  "Texto de compartilhamento copiado!"
                                );
                              } else {
                                window.alert(shareText);
                              }
                            } catch (error) {
                              if (error?.name !== "AbortError") {
                                console.error(
                                  "Erro ao compartilhar:",
                                  error
                                );
                              }
                            }
                          }}
                        >
                          ↗ Compartilhar
                        </button>
                      </div>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="dv-request-comments">
                      <h4>Comentários da comunidade</h4>
                      {commentsLoading[request.id] ? (
                        <p className="dv-message">
                          Carregando comentários...
                        </p>
                      ) : comments.length === 0 ? (
                        <p className="dv-request-no-comments">
                          Ainda não há comentários. Seja a primeira pessoa a
                          comentar!
                        </p>
                      ) : (
                        <div className="dv-request-comment-list">
                          {comments.map((comment) => (
                            <div
                              className="dv-request-comment"
                              key={comment.id}
                            >
                              <div className="dv-request-comment-avatar">
                                {comment.author_avatar_url ? (
                                  <img
                                    src={comment.author_avatar_url}
                                    alt=""
                                    onError={hideBrokenImage}
                                  />
                                ) : (
                                  "♙"
                                )}
                              </div>
                              <div className="dv-request-comment-body">
                                <div className="dv-request-comment-meta">
                                  <strong>
                                    {comment.author_name ||
                                      (comment.user_id === user?.id
                                        ? user?.user_metadata?.full_name ||
                                          user?.email?.split("@")[0] ||
                                          "Você"
                                        : "Membro DRAMOVIX")}
                                  </strong>
                                  <small>
                                    {formatDate(comment.created_at)}
                                  </small>
                                </div>
                                <p>{comment.content}</p>
                                {user &&
                                  comment.user_id === user.id && (
                                    <button
                                      type="button"
                                      className="dv-request-delete-comment"
                                      onClick={() =>
                                        deleteRequestComment(
                                          comment,
                                          request.id
                                        )
                                      }
                                    >
                                      Excluir comentário
                                    </button>
                                  )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <form
                        className="dv-request-comment-form"
                        onSubmit={(event) =>
                          submitRequestComment(event, request)
                        }
                      >
                        <textarea
                          value={commentDrafts[request.id] || ""}
                          onChange={(event) =>
                            setCommentDrafts((prev) => ({
                              ...prev,
                              [request.id]: event.target.value
                            }))
                          }
                          placeholder={
                            user
                              ? "Escreva um comentário..."
                              : "Entre na sua conta para comentar..."
                          }
                          maxLength={1000}
                          rows={2}
                          disabled={!user}
                        />
                        <button
                          type="submit"
                          className="dv-button-primary"
                          disabled={
                            !user ||
                            Boolean(commentBusy[request.id]) ||
                            !(commentDrafts[request.id] || "").trim()
                          }
                        >
                          {commentBusy[request.id]
                            ? "Enviando..."
                            : "Comentar"}
                        </button>
                      </form>
                      {!user && (
                        <button
                          type="button"
                          className="dv-request-login-link"
                          onClick={() => openAuth("signin")}
                        >
                          Entre na sua conta para participar
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
        <p className="dv-request-footer-note">
          Os status indicam o andamento das solicitações. A publicação de uma
          série no catálogo depende da disponibilidade do conteúdo.
        </p>
      </section>
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
        <button
          className="dv-header-support"
          type="button"
          onClick={() => { setDonationOpen(true); setPixCopied(false); }}
          aria-label="Apoie o DRAMOVIX"
          title="Apoie o DRAMOVIX"
        >
          <span aria-hidden="true">♥</span> Apoie
        </button>
        <button
          className="dv-header-support dv-header-requests"
          type="button"
          onClick={() => goToPage("solicitacoes")}
          aria-label="Ver pedidos de séries"
          title="Pedidos de séries"
        >
          <span aria-hidden="true">▣</span> Pedidos
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
            onClick={() => setProfileOpen((value) => !value)}
            aria-label="Perfil"
          >
            ♙
          </button>
        </div>
      </header>
      <nav
        className="dv-mobile-categories"
        aria-label="Categorias principais"
      >
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
        <button
          className={page === "solicitacoes" ? "active" : ""}
          onClick={openRequestsPage}
        >
          <span>＋</span>
          Pedidos
        </button>
        <button
          className="dv-mobile-donation"
          onClick={() => {
            setDonationOpen(true);
            setPixCopied(false);
          }}
        >
          <span>♥</span>
          Apoie
        </button>
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
            onClick={() =>
              key === "filmes-tab"
                ? goToPage("filmes-lista")
                : goToPage(key)
            }
          >
            <span className="dv-side-icon">{icon}</span>
            <span>{tr(label)}</span>
          </button>
        ))}
        <button
          className={`dv-side-link ${
            page === "solicitacoes" ? "active" : ""
          }`}
          onClick={openRequestsPage}
        >
          <span className="dv-side-icon">＋</span>
          <span>Solicitar séries</span>
        </button>
        <button className="dv-side-link dv-donation-link" onClick={() => { setDonationOpen(true); setPixCopied(false); }}>
          <span className="dv-side-icon">♥</span><span>Apoie o DRAMOVIX</span>
        </button>
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
              <div className="dv-avatar-wrap dv-avatar-wrap-menu">
                <div className="dv-profile-avatar">
                  {user?.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="Foto de perfil" onError={hideBrokenImage} />
                  ) : (
                    "♙"
                  )}
                </div>
              </div>
              <div className="dv-profile-identity">
                <strong>
                  {user?.user_metadata?.full_name ||
                    user?.email?.split("@")[0] ||
                    tr("Meu perfil")}
                </strong>
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
                  onClick={() =>
                    navigator.clipboard?.writeText(visitorId)
                  }
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
            <button
              className="dv-profile-item"
              onClick={openRequestsPage}
            >
              <span>＋</span>
              <span>Solicitar séries</span>
              <b>›</b>
            </button>
            <div className="dv-profile-item dv-language-item">
              <span>🌐</span>
              <span>{tr("Mudança de linguagem")}</span>
              <select
                aria-label="Idioma"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
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
        {page === "solicitacoes" && renderRequestsPage()}
        {page === "detalhes" && selectedSeries && (
          <section className="dv-detail">
            <button className="dv-back" onClick={() => goToPage("filmes")}>
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
                    ? selectedSeries.description || "Descrição indisponível."
                    : (selectedSeries.description || "Uma história incrível.")
                        .slice(0, 160) +
                      ((selectedSeries.description || "").length > 160
                        ? "..."
                        : "")}
                </p>
                {(selectedSeries.description || "").length > 160 && (
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
                      ? "♥ Salva"
                      : "♡ Salvar"}
                  </button>
                  <button
                    className="dv-description-toggle dv-share-series"
                    onClick={() => shareSeries(selectedSeries)}
                  >
                    ↗ Compartilhar
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
                    ? selectedMovie.description || "Descrição indisponível."
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
                <span className="dv-eyebrow">{tr("EM DESTAQUE")}</span>
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
                  title: entry.contentTitle || entry.title
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
            <section className="dv-section">
              <div className="dv-section-heading">
                <h2>Solicitações da comunidade</h2>
                <button
                  className="dv-see-all"
                  onClick={openRequestsPage}
                >
                  Ver pedidos ›
                </button>
              </div>
            </section>
          </>
        )}
        {page === "filmes-lista" && (
          <>
          {renderPlaylistCatalog("movies")}
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
          </>
        )}
        {page === "series" && (
          <>
          {renderPlaylistCatalog("series")}
          <section className="dv-section">
            <div className="dv-section-heading">
              <div>
                <h2>{tr("SÉRIES")}</h2>
                <p>{tr("Maratone as melhores séries e minisséries.")}</p>
              </div>
            </div>
            {renderGenreFilters()}
            {renderGrid(ordinarySeries)}
          </section>
          </>
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
          <>
          <section
            className="dv-hero"
            style={{
              backgroundImage: liveHeroItem?.image
                ? `url("${liveHeroItem.image}")`
                : "none"
            }}
          >
            <div className="dv-hero-overlay" />
            <div className="dv-hero-content">
              <span className="dv-eyebrow">TV AO VIVO</span>
              <h1>{liveHeroItem?.title || "TV ao Vivo"}</h1>
              <p>
                {liveHeroItem?.description
                  ? liveHeroItem.description.slice(0, 140)
                  : "Assista às transmissões disponíveis."}
              </p>
              <button
                className="dv-button-primary"
                onClick={() => openLive(liveHeroItem)}
              >
                ▶ Assistir ao vivo
              </button>
            </div>
          </section>
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
          </>
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
              onChange={(event) => setSearch(event.target.value)}
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
                <p>{tr("Conteúdos reproduzidos neste navegador.")}</p>
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
                  {tr("Quando você assistir a algo, aparecerá aqui.")}
                </p>
              </div>
            ) : (
              <div className="dv-history-list">
                {watchHistory.map((entry, index) => (
                  <button
                    className="dv-history-item"
                    key={`${entry.id}-${index}`}
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
                      <strong>{entry.contentTitle || entry.title}</strong>
                      <small>{new Date(entry.watchedAt).toLocaleString()}</small>
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
              <h2>{profileSection === "conta" ? "Conta" : tr("Perfil")}</h2>
            </div>
            {profileSection === "perfil" ? (
              <div className="dv-account-card dv-profile-summary">
                <div className="dv-avatar-wrap dv-avatar-wrap-large">
                  <div className="dv-profile-avatar dv-profile-avatar-large">
                    {user?.user_metadata?.avatar_url ? (
                      <img src={user.user_metadata.avatar_url} alt="Foto de perfil" onError={hideBrokenImage} />
                    ) : (
                      "♙"
                    )}
                  </div>
                  {user && (
                    <button type="button" className="dv-avatar-edit" aria-label="Editar foto de perfil" title="Editar foto" onClick={() => setAvatarOptionsOpen((open) => !open)}>✎</button>
                  )}
                  {user && avatarOptionsOpen && (
                    <div className="dv-avatar-popover dv-avatar-popover-large">
                      <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={avatarBusy}>📷 {avatarBusy ? "Salvando..." : "Mudar foto"}</button>
                      {user.user_metadata?.avatar_url && <button type="button" onClick={removeAvatar} disabled={avatarBusy}>🗑️ Remover foto</button>}
                      <small>JPG, PNG ou WEBP · até 5 MB</small>
                      {avatarMessage && <small className="dv-avatar-message">{avatarMessage}</small>}
                    </div>
                  )}
                </div>
                <input ref={avatarInputRef} className="dv-avatar-hidden-input" type="file" accept="image/*" onChange={handleAvatarUpload} disabled={avatarBusy} />
                <h2>
                  {user?.user_metadata?.full_name ||
                    user?.email?.split("@")[0] ||
                    tr("Visitante DRAMOVIX")}
                </h2>
                <button className="dv-account-option" type="button" onClick={() => { setAvatarOptionsOpen(false); setProfileSection("conta"); }}>
                  <span><strong>Conta</strong><small>Dados do cadastro e e-mail conectado</small></span>
                  <b>›</b>
                </button>
              </div>
            ) : (
              <div className="dv-account-card dv-account-details">
                <button className="dv-account-back" type="button" onClick={() => setProfileSection("perfil")}>‹ Voltar ao perfil</button>
                {user ? (
                  <>
                    <div className="dv-account-detail-row">
                      <small>Nome</small>
                      <strong>{user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuário DRAMOVIX"}</strong>
                    </div>
                    <div className="dv-account-detail-row">
                      <small>E-mail conectado</small>
                      <strong className="dv-account-email">{user.email}</strong>
                    </div>
                    <div className="dv-account-detail-row">
                      <small>Cadastro realizado em</small>
                      <strong>{user.created_at ? new Date(user.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : "Informação indisponível"}</strong>
                    </div>
                    <p className="dv-muted">Sua conta identifica você no DRAMOVIX. Seus favoritos e histórico atuais ainda ficam salvos neste navegador.</p>
                    <button className="dv-button-primary" onClick={signOut}>Sair da conta</button>
                  </>
                ) : (
                  <>
                    <h3>Você está navegando como visitante</h3>
                    <p>Entre em uma conta ou crie uma conta grátis para ver os dados do cadastro aqui.</p>
                    <small>{tr("Seu ID de visitante")}</small>
                    <strong>{visitorId}</strong>
                    <button className="dv-button-primary" onClick={() => openAuth("signin")}>Entrar na conta</button>
                    <button className="dv-profile-auth-button dv-profile-auth-secondary" onClick={() => openAuth("signup")}>Criar conta grátis</button>
                  </>
                )}
              </div>
            )}
          </section>
        )}
      </main>
      <footer className="dv-footer">
        DRAMOVIX · Sempre tem uma nova história.
      </footer>
      {moreMenuOpen && (
        <div className="dv-more-menu-layer">
          <button className="dv-more-menu-scrim" type="button" aria-label="Fechar menu Mais" onClick={() => setMoreMenuOpen(false)} />
          <section className="dv-more-menu" aria-label="Mais opções">
            <div className="dv-more-menu-heading">
              <div><strong>Mais opções</strong><small>Explore outras áreas do DRAMOVIX</small></div>
              <button type="button" onClick={() => setMoreMenuOpen(false)} aria-label="Fechar">×</button>
            </div>
            <div className="dv-more-menu-grid">
              <button type="button" onClick={() => { setMoreMenuOpen(false); goToPage("series"); }}><span>▤</span>Séries</button>
              <button type="button" onClick={() => { setMoreMenuOpen(false); goToPage("desenhos"); }}><span>🎨</span>Desenhos</button>
              <button type="button" onClick={() => { setMoreMenuOpen(false); goToPage("animes"); }}><span>🎌</span>Anime</button>
              <button type="button" onClick={() => { setMoreMenuOpen(false); goToPage("doramas"); }}><span>♡</span>Doramas</button>
              <button type="button" onClick={() => { setMoreMenuOpen(false); goToPage("tv"); }}><span>◉</span>TV ao Vivo</button>
              <button type="button" onClick={() => { setMoreMenuOpen(false); openRequestsPage(); }}><span>＋</span>Pedidos</button>
              <button type="button" onClick={() => { setMoreMenuOpen(false); setDonationOpen(true); setPixCopied(false); }}><span>♥</span>Apoie</button>
              <button type="button" onClick={() => { setMoreMenuOpen(false); setProfileOpen(true); }}><span>♙</span>Perfil e conta</button>
            </div>
          </section>
        </div>
      )}
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
          className={moreMenuOpen || ["series", "desenhos", "animes", "doramas", "tv", "solicitacoes"].includes(page) ? "active" : ""}
          onClick={() => setMoreMenuOpen((open) => !open)}
          aria-expanded={moreMenuOpen}
          aria-label="Mais opções"
        >
          <span>☰</span>
          <small>Mais</small>
        </button>
      </nav>
      {requestFormOpen && (
        <div
          className="dv-auth-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setRequestFormOpen(false);
            }
          }}
        >
          <section
            className="dv-auth-modal dv-request-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dv-request-title"
          >
            <button
              className="dv-auth-close"
              type="button"
              onClick={() => setRequestFormOpen(false)}
              aria-label="Fechar"
            >
              ×
            </button>
            <div className="dv-auth-brand">DRAMOVIX</div>
            <h2 id="dv-request-title">Solicitar uma série</h2>
            <p className="dv-auth-subtitle">
              Conte para a comunidade qual série você gostaria de assistir.
            </p>
            <form
              className="dv-auth-form"
              onSubmit={submitSeriesRequest}
            >
              <label>
                Nome da série *
                <input
                  className="dv-auth-input"
                  type="text"
                  value={requestTitle}
                  onChange={(event) =>
                    setRequestTitle(event.target.value)
                  }
                  placeholder="Digite o nome da série"
                  maxLength={150}
                  required
                />
              </label>
              <label>
                Link da capa (opcional)
                <input
                  className="dv-auth-input"
                  type="url"
                  value={requestCover}
                  onChange={(event) =>
                    setRequestCover(event.target.value)
                  }
                  placeholder="https://..."
                />
              </label>
              <label>
                Idioma desejado
                <select
                  className="dv-auth-input"
                  value={requestLanguage}
                  onChange={(event) =>
                    setRequestLanguage(event.target.value)
                  }
                >
                  <option value="Dublado">Dublado</option>
                  <option value="Legendado">Legendado</option>
                  <option value="Ambos">Dublado e legendado</option>
                </select>
              </label>
              <label>
                Informações adicionais (opcional)
                <textarea
                  className="dv-auth-input"
                  value={requestDescription}
                  onChange={(event) =>
                    setRequestDescription(event.target.value)
                  }
                  placeholder="Conte mais sobre a série que procura..."
                  maxLength={1000}
                  rows={4}
                />
              </label>
              {requestMessage && (
                <p className="dv-auth-error" role="alert">
                  {requestMessage}
                </p>
              )}
              <button
                className="dv-auth-submit"
                type="submit"
                disabled={requestBusy}
              >
                {requestBusy ? "Enviando solicitação..." : "Enviar solicitação"}
              </button>
            </form>
          </section>
        </div>
      )}
      {playerOpen && (
        <div
          className="dv-player-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) closePlayer();
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
                autoPlay
                preload="auto"
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
                {episodes.map((ep, index) => (
                  <button
                    key={ep.id || index}
                    className={
                      String(selectedEpisode?.id) === String(ep.id)
                        ? "selected"
                        : ""
                    }
                    onClick={() => openEpisode(ep)}
                  >
                    Episódio {ep.episode_number || index + 1}:{" "}
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
                  onClick={() =>
                    setEpisodeDrawerOpen((value) => !value)
                  }
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
      {donationOpen && (
        <div className="dv-donation-overlay" onClick={(event) => { if (event.target === event.currentTarget) setDonationOpen(false); }}>
          <section className="dv-donation-modal" role="dialog" aria-modal="true" aria-labelledby="dv-donation-title">
            <button className="dv-donation-close" type="button" onClick={() => setDonationOpen(false)} aria-label="Fechar">×</button>
            <div className="dv-donation-heart">♥</div>
            <p className="dv-donation-eyebrow">UMA MENSAGEM DE CORAÇÃO</p>
            <h2 id="dv-donation-title">Vamos manter essa história viva? ❤️</h2>
            <p className="dv-donation-message">O DRAMOVIX nasceu para reunir histórias e criar momentos de diversão. Se você gosta do projeto e quiser ajudar a mantê-lo vivo, sua contribuição será recebida com muito carinho. Apoiar é totalmente opcional: você continua livre para aproveitar o catálogo, sem assinatura ou obrigação de pagar.</p>
            <a className="dv-donation-payment-link" href="https://nubank.com.br/cobrar/7m0g1/6ad6e05e-699f-43b8-8df8-2bafba9d9afd" target="_blank" rel="noopener noreferrer">💜 Quero apoiar pelo Pix</a>
            <p className="dv-donation-link-note">O link abre a página de cobrança do Nubank ou direciona conforme as opções disponíveis no seu aparelho.</p>
            <div className="dv-donation-pix-card">
              <span className="dv-donation-pix-label">PIX COPIA E COLA · QUALQUER BANCO</span>
              <strong className="dv-donation-pix-key">00020126360014BR.GOV.BCB.PIX0114+55479880061055204000053039865802BR5925Mauricelio da Silva Castr6009SAO PAULO62140510FzsqYa4XeW6304FEA9</strong>
              <button className="dv-donation-copy" type="button" onClick={async () => { try { await navigator.clipboard.writeText("00020126360014BR.GOV.BCB.PIX0114+55479880061055204000053039865802BR5925Mauricelio da Silva Castr6009SAO PAULO62140510FzsqYa4XeW6304FEA9"); setPixCopied(true); } catch { setPixCopied(false); } }}>
                {pixCopied ? "✓ Chave Pix copiada!" : "▣ Copiar código Pix"}
              </button>
            </div>
            <p className="dv-donation-instructions">A contribuição é livre. Se preferir transferir por chave Pix, copie a chave, abra o app do seu banco e informe o valor que desejar. Antes de confirmar, confira o nome do destinatário exibido pelo banco.</p>
            <p className="dv-donation-thanks">Cada gesto de apoio ajuda essa história a continuar. Muito obrigado por estar aqui! 🍿❤️</p>
          </section>
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
                    onChange={(event) =>
                      setAuthName(event.target.value)
                    }
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
                  onChange={(event) =>
                    setAuthEmail(event.target.value)
                  }
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
                Ao se cadastrar, você poderá precisar confirmar seu e-mail
                antes de entrar.
              </small>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
