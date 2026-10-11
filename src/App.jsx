<div className="dv-episodes">
  {episodes.map((episode, index) => {
    const number = episode.episode_number || index + 1;
    const title = (episode.title || "")
      .replace(/^epis[oó]dio\s*\d+\s*[-:.]?\s*/i, "")
      .trim();
    return (
      <button
        key={episode.id || index}
        className="dv-episode"
        onClick={() => {
          setSelectedEpisode(episode);
          openPlayer(
            {
              ...episode,
              name: title
                ? `Episódio ${number} — ${title}`
                : `Episódio ${number}`,
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
        <span className="dv-episode-play">▶</span>
      </button>
    );
  })}
</div>
