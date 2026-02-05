document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.getElementById('syr-gallery-grid');
    if (!grid) return;

    try {
        const response = await fetch('/apps/videos');
        if (response.ok) {
            const data = await response.json();
            const videos = data.videos || [];

            if (videos.length === 0) {
                grid.innerHTML = '<p>No reactions yet. Be the first!</p>';
                return;
            }

            grid.innerHTML = videos.map(video => `
                <div class="syr-video-card">
                    <div class="syr-thumbnail-wrapper">
                         ${video.thumbnailLink ?
                    `<img src="${video.thumbnailLink}" alt="Video Thumbnail" loading="lazy" />` :
                    `<div class="syr-placeholder">Video</div>`
                }
                    </div>
                    <div class="syr-card-actions">
                        <a href="${video.webContentLink}" target="_blank" class="syr-watch-btn">Watch</a>
                    </div>
                </div>
            `).join('');
        } else {
            grid.innerHTML = '<p>Could not load videos.</p>';
        }
    } catch (e) {
        console.error(e);
        grid.innerHTML = '<p>Failed to load videos.</p>';
    }
});
