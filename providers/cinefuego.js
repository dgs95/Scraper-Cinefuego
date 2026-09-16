const PROVIDER_NAME = "FuegoCine";
const BASE_URL = "https://www.fuegocine.com";

function getStreams(tmdbId, mediaType, season, episode) {
    console.log(`[${PROVIDER_NAME}] Iniciando búsqueda para ${mediaType} TMDB: ${tmdbId}`);

    // 1. Traducir tmdbId al título real usando Cinemeta
    const metaType = mediaType === 'tv' ? 'series' : 'movie';
    const metaUrl = `https://v3-cinemeta.strem.io/meta/${metaType}/tmdb:${tmdbId}.json`;

    return fetch(metaUrl)
        .then(res => res.json())
        .then(meta => {
            if (!meta || !meta.meta || !meta.meta.name) {
                throw new Error("No se pudo resolver el título desde TMDB");
            }
            
            const title = meta.meta.name;
            const searchQuery = encodeURIComponent(title);
            const searchUrl = `${BASE_URL}/?s=${searchQuery}`;
            
            console.log(`[${PROVIDER_NAME}] Buscando en FuegoCine: ${title}`);
            return fetch(searchUrl);
        })
        .then(res => res.text())
        .then(html => {
            // 2. Extraer la URL del resultado de búsqueda
            // Buscar el primer enlace que coincida con un post de FuegoCine
            const linkMatch = html.match(/<a[^>]+href="(https?:\/\/(?:www\.)?fuegocine\.com\/[^"]+)"/i);
            
            if (!linkMatch) {
                throw new Error("Sin resultados en FuegoCine");
            }
            
            let mediaUrl = linkMatch[1];
            
            // Lógica básica de ruteo para episodios de series
            if (mediaType === 'tv' && season && episode) {
                // Ajusta este reemplazo según la estructura exacta de FuegoCine
                // Ejemplo común: /episodio/nombre-serie-1x1/
                mediaUrl = mediaUrl.replace('/series/', '/episodios/') + `-${season}x${episode}/`;
            }

            console.log(`[${PROVIDER_NAME}] Procesando enlace: ${mediaUrl}`);
            return fetch(mediaUrl);
        })
        .then(res => res.text())
        .then(html => {
            // 3. Extraer los streams de la página final
            const streams = [];
            
            // Prioridad A: Buscar fuentes directas HLS (.m3u8)
            // Estas son ideales para que el reproductor maneje la decodificación nativa
            const m3u8Regex = /(https?:\/\/[^"'\s]+\.m3u8)/g;
            let m3u8Match;
            while ((m3u8Match = m3u8Regex.exec(html)) !== null) {
                streams.push({
                    name: PROVIDER_NAME,
                    title: "Directo HLS (Nativo)",
                    url: m3u8Match[1],
                    quality: "Auto"
                });
            }

            // Prioridad B: Buscar iframes embebidos de servidores externos
            const iframeRegex = /<iframe[^>]+src="([^"]+)"/g;
            let iframeMatch;
            while ((iframeMatch = iframeRegex.exec(html)) !== null) {
                const videoUrl = iframeMatch[1];
                
                // Filtrar anuncios o trailers de YouTube
                if (videoUrl.includes("youtube.com")) continue;
                
                streams.push({
                    name: PROVIDER_NAME,
                    title: "Servidor Externo Embebido",
                    url: videoUrl,
                    quality: "Desconocida" // El reproductor resolverá la resolución real
                });
            }

            return streams;
        })
        .catch(error => {
            console.error(`[${PROVIDER_NAME}] Error de extracción:`, error.message);
            return []; // Nuvio espera un array vacío si falla, no un crash
        });
}

// Nuvio requiere que se exporte obligatoriamente la función getStreams
module.exports = { getStreams };
