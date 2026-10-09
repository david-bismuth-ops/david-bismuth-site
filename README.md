# david-bismuth.com

Reconstruction statique du site Readymag (octobre 2026) : même identité (fond `#c7c7c1`, typographie blanche, grille de vidéos en boucle, nom de la marque au survol, lecture plein écran), sans abonnement ni dépendance à Readymag.

Aucun outil à installer : ce sont des fichiers HTML/CSS/JS à déposer tels quels sur n'importe quel hébergeur statique.

## Structure

```
index.html            accueil (vidéo plein écran → projets)
projects/index.html   grille principale (8 projets)
other/index.html      projets additionnels (8) + lecteur audio
about/index.html      à propos
welcome/              redirige l'ancienne adresse /welcome/ vers l'accueil
assets/style.css      toute la mise en page (mesures reprises de la maquette Readymag en 1920 px)
assets/site.js        aperçus vidéo, lecture plein écran, lecteur audio
assets/fonts/         Inter Tight (équivalent libre d'Aktiv Grotesk)
media/                aperçus muets (*.mp4), posters (*.jpg), films avec son (*-full.mp4), musiques (*.mp3)
```

## Ajouter ou modifier un projet

Tous les films sont hébergés sur le site (plus besoin de Vimeo). Dans `projects/index.html` ou `other/index.html`, copier un bloc `<a class="tile">` :

```html
<a class="tile" href="../media/marque-full.mp4" data-film="../media/marque-full.mp4"
   data-credit="music produced under the supervision of BRUIT" aria-label="Marque — Campagne">
  <video data-preview src="../media/marque.mp4" poster="../media/marque.jpg" muted loop playsinline preload="none"></video>
  <span class="tile-label" aria-hidden="true">MARQUE</span>
</a>
```

- `media/marque-full.mp4` : le film avec le son, lu en plein écran. Viser 1280 px de large en H.264 + AAC, et rester sous 50 Mo, car GitHub refuse les fichiers de plus de 100 Mo.
- `media/marque.mp4` : l'aperçu muet de la grille, d'environ 12 s en 960 px. Viser moins de 1 Mo.
- `media/marque.jpg` : l'image affichée avant le chargement de l'aperçu.
- `data-portrait` pour un film vertical (9:16).
- `data-credit` : la mention affichée sous le film (facultatif).

Les films ont été ré-encodés en 1280 px depuis les téléchargements Vimeo (`~/Downloads`), et Klara depuis le master du disque Storage. Le son est copié tel quel, sans ré-encodage. Coltesse vient du fichier Readymag.

## Mise en ligne gratuite : GitHub Pages

1. Sur github.com, créer un dépôt **public** (ex. `david-bismuth-site`).
2. Dans ce dossier :
   ```bash
   git init && git add . && git commit -m "Site david-bismuth.com"
   git branch -M main
   git remote add origin https://github.com/<ton-compte>/david-bismuth-site.git
   git push -u origin main
   ```
3. Dans le dépôt, aller dans **Settings → Pages**. Choisir la source *Deploy from a branch*, puis `main` et `/ (root)`. Vérifier ensuite le site sur `https://<ton-compte>.github.io/david-bismuth-site/`. Le jour de la bascule, mettre `david-bismuth.com` dans *Custom domain* : GitHub ajoute alors lui-même un fichier `CNAME` au dépôt (faire `git pull` avant la modification suivante).
4. Chez **OVH**, dans *Domaines → david-bismuth.com → Zone DNS* :
   - supprimer l'enregistrement `A` de `david-bismuth.com` qui pointe vers Readymag (`54.194.41.141`), ainsi que celui de `www` ;
   - ajouter 4 enregistrements `A` pour `david-bismuth.com` : `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` ;
   - ajouter un `CNAME` : `www` → `<ton-compte>.github.io.` ;
   - **ne pas toucher** aux `MX` ni au `TXT` SPF (la messagerie OVH).
5. Après la propagation DNS (de quelques minutes à quelques heures), cocher **Enforce HTTPS** dans Settings → Pages.
6. Résilier Readymag **seulement une fois** le nouveau site en ligne sur le domaine.

Pour mettre à jour le site ensuite : modifier les fichiers, puis lancer `git add . && git commit -m "…" && git push`. Le site se met à jour en environ une minute.

### Alternative sans git : Cloudflare Pages

Sur dash.cloudflare.com, ouvrir *Workers & Pages → Create → Pages → Upload assets*, puis glisser ce dossier. La bande passante est illimitée. Pour utiliser `david-bismuth.com`, il faut faire passer les serveurs DNS du domaine d'OVH à Cloudflare.

## Police d'origine (facultatif)

L'original utilise **Aktiv Grotesk**, une police Adobe Fonts. Avec un abonnement Creative Cloud, crée un projet web sur fonts.adobe.com avec Aktiv Grotesk (300, 500, 700), autorise le domaine, puis colle la ligne `<link rel="stylesheet" href="https://use.typekit.net/xxxxxxx.css">` dans le `<head>` de chaque page. Le CSS l'utilise automatiquement. Sans ce kit, c'est Inter Tight qui s'affiche.

## Tester en local

```bash
python3 -m http.server 8765
```
Ouvrir ensuite http://localhost:8765.
