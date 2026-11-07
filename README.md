# La Porte

Petit jeu web en 3D : dans une salle souterraine, on compose une adresse de sept symboles sur une porte des étoiles, on regarde l'anneau tourner et les chevrons se verrouiller, puis le vortex s'ouvre… ou pas.

Projet de fan, non officiel. La salle, la porte, les symboles, les sons et les planètes sont des créations originales.

## Fonctionnalités

- **Composition** : 6 symboles au choix parmi 38, le 7ᵉ (point d'origine) est ajouté automatiquement.
- **Salle en 3D** (Three.js) : hangar en béton, plateforme et rampe, salle de contrôle vitrée en hauteur, gyrophares pendant la composition, vortex qui éclaire la pièce.
- **Gardes** : six militaires génériques autour de la porte et devant les portes P-51 et P-52. Ils se mettent en alerte pendant la composition et mettent la porte en joue quand le vortex s'ouvre (sauf si l'iris est fermé).
- **Caméra libre** : glisser pour tourner, molette ou pincement pour zoomer, clic droit ou deux doigts pour se déplacer, et des points de vue prêts (vue d'ensemble, face à la porte, sur la rampe, salle de contrôle, près des gardes, accès P-51 et P-52).
- **Animation de la porte** : rotation de l'anneau en alternant le sens, chevrons qui s'enclenchent, jaillissement puis surface ondulante du vortex, iris.
- **Carnet d'adresses** : enregistrer ses planètes (nom, désignation au format `P3X-582`, notes, coordonnées), les charger, modifier ou supprimer.
- **Mondes inexplorés** : une adresse inconnue a environ une chance sur quatre de mener à un monde généré, ajouté au carnet.
- **Sons** : synthétisés en direct avec Web Audio, chacun remplaçable par un fichier audio importé.
- **Raccourcis** : Entrée pour activer, Retour arrière pour effacer un symbole, Échap pour fermer le vortex.

Le carnet est enregistré dans le `localStorage` du navigateur, et les sons importés dans IndexedDB.

## Lancer le projet

Prérequis : Node.js 18.18 ou plus récent, et un navigateur avec WebGL.

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:3000.

Version de production :

```bash
npm run build
npm start
```

## Organisation du code

| Fichier | Rôle |
| --- | --- |
| `app/page.tsx`, `app/layout.tsx` | Point d'entrée Next.js (App Router) |
| `app/globals.css` | Styles et couleurs du thème |
| `components/StargateConsole.tsx` | Écran principal : adresse, clavier, actions, journal |
| `components/GateScene3D.tsx` | Vue 3D : rendu, caméra et points de vue |
| `lib/scene/gateRoom.ts` | Construction de la salle et de la porte en 3D, animation |
| `lib/scene/soldiers.ts` | Gardes : silhouettes, postures et animation |
| `lib/scene/textures.ts` | Textures générées (béton, anneau des symboles, écrans) |
| `components/PlanetForm.tsx` | Formulaire d'enregistrement d'une planète |
| `components/AddressBook.tsx` | Carnet d'adresses |
| `components/SoundSettings.tsx` | Import des sons personnalisés |
| `components/DestCard.tsx` | Fiche de la destination quand le vortex est ouvert |
| `lib/gateEngine.ts` | Logique de composition (indépendante de React) |
| `lib/audio.ts` | Moteur sonore |
| `lib/glyphs.ts` | Génération des 39 symboles |
| `lib/worlds.ts` | Planètes, désignations, mondes générés |
| `lib/storage.ts` | Sauvegarde du carnet et des sons |

## Déployer

Le plus simple est [Vercel](https://vercel.com/new) : importer le dépôt GitHub, aucun réglage nécessaire.
