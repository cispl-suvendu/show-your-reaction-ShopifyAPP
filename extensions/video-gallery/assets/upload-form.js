document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('#syr-upload-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const statusDiv = document.querySelector('#syr-upload-status');
        const submitBtn = form.querySelector('button[type="submit"]');

        // Disable button
        submitBtn.disabled = true;
        submitBtn.textContent = 'Uploading...';
        statusDiv.textContent = '';
        statusDiv.className = 'syr-status';

        const formData = new FormData(form);

        // Get the shop domain from the current URL if possible, or relative path helper
        // App Proxy relative path: /apps/videos/upload? or just POST to /apps/videos
        // We configured subpath "videos".

        try {
            // We append ?shop=... if we can get it, but proxy handles it automatically on backend usually?
            // Actually, for POST to proxy, Shopify forwards it.
            // But we need to ensure we hit the right proxy.
            const proxyUrl = '/apps/videos';

            const response = await fetch(proxyUrl, {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                const result = await response.json();
                statusDiv.textContent = 'Success! Your video is submitted for approval.';
                statusDiv.classList.add('syr-success');
                form.reset();
            } else {
                // Try to get text error
                let errorMsg = 'Upload failed.';
                try {
                    const result = await response.json();
                    if (result.error) errorMsg = result.error;
                } catch (e) { }

                statusDiv.textContent = errorMsg;
                statusDiv.classList.add('syr-error');
            }
        } catch (err) {
            console.error(err);
            statusDiv.textContent = 'Network error during upload.';
            statusDiv.classList.add('syr-error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Upload Reaction';
        }
    });
});
