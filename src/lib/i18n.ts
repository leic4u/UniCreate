import { useSettingsStore } from "@/stores/settings-store";
import type { AppLanguage } from "@/stores/settings-store";

const translations = {
  // ── Home ──
  "home.tagline": {
    en: "Create and submit WinGet package manifests with ease.",
    fr: "Créez et soumettez vos manifestes WinGet en toute simplicité.",
  },
  "home.newPackage": { en: "New Package", fr: "Nouveau paquet" },
  "home.newPackage.desc": { en: "Create from scratch", fr: "Créer depuis zéro" },
  "home.updatePackage": { en: "Update Package", fr: "Mettre à jour" },
  "home.updatePackage.desc": { en: "New version of existing", fr: "Nouvelle version" },
  "home.recentSubmissions": { en: "Recent Submissions", fr: "Soumissions récentes" },
  "home.noSubmissions": {
    en: "No recent submissions yet. Connect via the profile button to recover PRs from GitHub.",
    fr: "Aucune soumission récente. Connectez-vous pour récupérer vos PRs GitHub.",
  },
  "home.updateExisting": { en: "Update Existing Package", fr: "Mettre à jour un paquet existant" },
  "home.updateExisting.desc": {
    en: "Enter the Package Identifier or paste a winget-pkgs URL to load existing metadata.",
    fr: "Entrez l'identifiant du paquet ou collez un lien winget-pkgs pour charger les métadonnées.",
  },
  "home.packageIdOrUrl": { en: "Package Identifier or URL", fr: "Identifiant du paquet ou URL" },
  "home.searchPlaceholder": { en: "Publisher.PackageName or winget-pkgs URL", fr: "Editeur.NomPaquet ou lien winget-pkgs" },
  "home.search": { en: "Search", fr: "Rechercher" },
  "home.searching": { en: "Searching winget-pkgs...", fr: "Recherche dans winget-pkgs..." },
  "home.packageFound": { en: "Package found", fr: "Paquet trouvé" },
  "home.updateThisPackage": { en: "Update this package", fr: "Mettre à jour ce paquet" },
  "home.allMetadataLoaded": {
    en: "All metadata will be loaded. You just need to add the new installer URL.",
    fr: "Toutes les métadonnées seront chargées. Ajoutez simplement la nouvelle URL d'installeur.",
  },
  "home.yourPackages": { en: "Your packages", fr: "Vos paquets" },
  "home.loadingPackages": { en: "Loading your packages...", fr: "Chargement de vos paquets..." },
  "home.back": { en: "Back", fr: "Retour" },
  "home.package": { en: "Package", fr: "Paquet" },
  "home.latestVersion": { en: "Latest Version", fr: "Dernière version" },
  "home.publisher": { en: "Publisher", fr: "Éditeur" },
  "home.name": { en: "Name", fr: "Nom" },
  "home.license": { en: "License", fr: "Licence" },
  "home.locale": { en: "Locale", fr: "Langue" },

  // ── Step Installer ──
  "installer.step": { en: "Step 1 of 4", fr: "Étape 1 sur 4" },
  "installer.title": { en: "Add Installers", fr: "Ajouter des installeurs" },
  "installer.titleUpdate": { en: "Update Installer", fr: "Mettre à jour l'installeur" },
  "installer.desc": {
    en: "Provide the download URL or drag & drop a local file. We'll compute the SHA256 hash and detect the installer type automatically.",
    fr: "Fournissez l'URL de téléchargement ou glissez-déposez un fichier. Le hash SHA256 et le type d'installeur seront détectés automatiquement.",
  },
  "installer.descUpdate": {
    en: "Add the new installer URL for {id}. SHA256 will be computed automatically.",
    fr: "Ajoutez la nouvelle URL d'installeur pour {id}. Le SHA256 sera calculé automatiquement.",
  },
  "installer.downloadUrl": { en: "Download URL", fr: "URL de téléchargement" },
  "installer.architecture": { en: "Architecture", fr: "Architecture" },
  "installer.installerType": { en: "Installer Type", fr: "Type d'installeur" },
  "installer.analyzeAdd": { en: "Analyze & Add", fr: "Analyser et ajouter" },
  "installer.downloading": { en: "Downloading & computing hash...", fr: "Téléchargement et calcul du hash..." },
  "installer.dragDrop": { en: "or drag & drop a local file to compute hash", fr: "ou glissez-déposez un fichier local" },
  "installer.dropHere": { en: "Drop file to compute hash", fr: "Déposez le fichier pour calculer le hash" },
  "installer.addWithLocalHash": { en: "Add with local hash", fr: "Ajouter avec le hash local" },
  "installer.localFile": { en: "Local file", fr: "Fichier local" },
  "installer.enterUrlThenAdd": { en: "Enter the download URL above, then click \"Add\"", fr: "Entrez l'URL de téléchargement ci-dessus, puis cliquez sur \"Ajouter\"" },
  "installer.yourRepos": { en: "Your repositories", fr: "Vos dépôts" },
  "installer.loadingRepos": { en: "Loading repositories...", fr: "Chargement des dépôts..." },
  "installer.noReleases": { en: "No releases with installers found.", fr: "Aucune release avec des installeurs trouvée." },
  "installer.added": { en: "{n} installer{s} added", fr: "{n} installeur{s} ajouté{s}" },
  "installer.duplicate": {
    en: "Duplicate installer detected — same Architecture + Type + Scope. WinGet requires unique combinations.",
    fr: "Doublon détecté — même Architecture + Type + Scope. WinGet exige des combinaisons uniques.",
  },
  "installer.autoFilled": {
    en: "Metadata auto-filled from GitHub repository. You can review and edit in the next step.",
    fr: "Métadonnées pré-remplies depuis le dépôt GitHub. Vous pourrez les vérifier à l'étape suivante.",
  },
  "installer.back": { en: "Back", fr: "Retour" },
  "installer.continue": { en: "Continue", fr: "Continuer" },

  // ── Step Metadata ──
  "metadata.step": { en: "Step 2 of 4", fr: "Étape 2 sur 4" },
  "metadata.title": { en: "Package Metadata", fr: "Métadonnées du paquet" },
  "metadata.desc": {
    en: "Fill in the required fields. Fields marked with * are mandatory.",
    fr: "Remplissez les champs requis. Les champs marqués d'un * sont obligatoires.",
  },
  "metadata.identity": { en: "Identity", fr: "Identité" },
  "metadata.packageId": { en: "Package Identifier", fr: "Identifiant du paquet" },
  "metadata.version": { en: "Version", fr: "Version" },
  "metadata.defaultLocale": { en: "Default Locale", fr: "Langue par défaut" },
  "metadata.publisher": { en: "Publisher", fr: "Éditeur" },
  "metadata.packageName": { en: "Package Name", fr: "Nom du paquet" },
  "metadata.license": { en: "License", fr: "Licence" },
  "metadata.shortDescription": { en: "Short Description", fr: "Description courte" },
  "metadata.description": { en: "Description", fr: "Description" },
  "metadata.author": { en: "Author", fr: "Auteur" },
  "metadata.moniker": { en: "Moniker", fr: "Alias" },
  "metadata.tags": { en: "Tags", fr: "Tags" },
  "metadata.urls": { en: "URLs", fr: "URLs" },
  "metadata.publisherUrl": { en: "Publisher URL", fr: "URL de l'éditeur" },
  "metadata.publisherSupportUrl": { en: "Support URL", fr: "URL de support" },
  "metadata.packageUrl": { en: "Package URL", fr: "URL du paquet" },
  "metadata.licenseUrl": { en: "License URL", fr: "URL de licence" },
  "metadata.privacyUrl": { en: "Privacy URL", fr: "URL de confidentialité" },
  "metadata.copyright": { en: "Copyright", fr: "Copyright" },
  "metadata.copyrightUrl": { en: "Copyright URL", fr: "URL du copyright" },
  "metadata.releaseNotes": { en: "Release Notes", fr: "Notes de version" },
  "metadata.releaseNotesUrl": { en: "Release Notes URL", fr: "URL des notes de version" },
  "metadata.additionalLocales": { en: "Additional Locales", fr: "Langues supplémentaires" },
  "metadata.addLocale": { en: "Add locale", fr: "Ajouter une langue" },
  "metadata.optional": { en: "Optional", fr: "Optionnel" },
  "metadata.back": { en: "Back", fr: "Retour" },
  "metadata.continue": { en: "Continue", fr: "Continuer" },
  "metadata.checking": { en: "Checking...", fr: "Vérification..." },
  "metadata.existsWarning": { en: "Package already exists — use Update mode for new versions.", fr: "Le paquet existe déjà — utilisez le mode Mise à jour pour les nouvelles versions." },
  "metadata.newPackage": { en: "New package — this identifier is available.", fr: "Nouveau paquet — cet identifiant est disponible." },
  "metadata.idHint": { en: "Format: Publisher.PackageName (e.g. Mozilla.Firefox)", fr: "Format : Editeur.NomPaquet (ex : Mozilla.Firefox)" },

  // ── Step Review ──
  "review.step": { en: "Step 3 of 4", fr: "Étape 3 sur 4" },
  "review.title": { en: "Review Manifests", fr: "Vérifier les manifestes" },
  "review.desc": {
    en: "Preview the YAML files that will be submitted. You can also save them locally.",
    fr: "Prévisualisez les fichiers YAML qui seront soumis. Vous pouvez aussi les sauvegarder localement.",
  },
  "review.saveToDesktop": { en: "Save to Desktop", fr: "Sauvegarder" },
  "review.editYaml": { en: "Edit YAML", fr: "Modifier le YAML" },
  "review.done": { en: "Done", fr: "Terminé" },
  "review.copy": { en: "Copy", fr: "Copier" },
  "review.copied": { en: "Copied", fr: "Copié" },
  "review.diff": { en: "Diff", fr: "Diff" },
  "review.preview": { en: "Preview", fr: "Aperçu" },
  "review.generating": { en: "Generating manifests...", fr: "Génération des manifestes..." },
  "review.fetchingOld": { en: "Fetching previous version...", fr: "Récupération de la version précédente..." },
  "review.noChanges": { en: "No changes", fr: "Aucun changement" },
  "review.couldNotFetch": {
    en: "Could not fetch previous version YAML for comparison.",
    fr: "Impossible de récupérer le YAML de la version précédente.",
  },
  "review.showingAsNew": {
    en: "Showing new YAML as all additions.",
    fr: "Affichage du nouveau YAML comme ajouts.",
  },
  "review.back": { en: "Back", fr: "Retour" },
  "review.continue": { en: "Continue", fr: "Continuer" },

  // ── Step Submit ──
  "submit.step": { en: "Step 4 of 4", fr: "Étape 4 sur 4" },
  "submit.title": { en: "Submit to WinGet", fr: "Soumettre à WinGet" },
  "submit.desc": {
    en: "Sign in with GitHub and submit your manifest as a pull request.",
    fr: "Connectez-vous avec GitHub et soumettez votre manifeste en tant que pull request.",
  },
  "submit.signIn": { en: "Sign in with GitHub", fr: "Se connecter avec GitHub" },
  "submit.deviceFlow": { en: "Use GitHub Device Flow", fr: "Utiliser GitHub Device Flow" },
  "submit.enterCode": { en: "Enter this code on GitHub:", fr: "Entrez ce code sur GitHub :" },
  "submit.waiting": { en: "Waiting for authorization...", fr: "En attente d'autorisation..." },
  "submit.openGithub": { en: "Open GitHub again", fr: "Ouvrir GitHub" },
  "submit.cancel": { en: "Cancel", fr: "Annuler" },
  "submit.remember": { en: "Remember session", fr: "Se souvenir de la session" },
  "submit.submitPr": { en: "Submit Pull Request", fr: "Soumettre la Pull Request" },
  "submit.submitting": { en: "Submitting...", fr: "Soumission en cours..." },
  "submit.success": { en: "Pull Request Created!", fr: "Pull Request créée !" },
  "submit.viewPr": { en: "View Pull Request", fr: "Voir la Pull Request" },
  "submit.newManifest": { en: "New Manifest", fr: "Nouveau manifeste" },
  "submit.summary": { en: "Summary", fr: "Résumé" },
  "submit.back": { en: "Back", fr: "Retour" },
  "submit.connectedAs": { en: "Authenticated as", fr: "Authentifié en tant que" },
  "submit.packageId": { en: "Package", fr: "Paquet" },
  "submit.version": { en: "Version", fr: "Version" },
  "submit.installers": { en: "Installers", fr: "Installeurs" },
  "submit.files": { en: "Files", fr: "Fichiers" },
  "submit.authTitle": { en: "GitHub Authentication", fr: "Authentification GitHub" },
  "submit.authDesc": { en: "Sign in with your GitHub account", fr: "Connectez-vous avec votre compte GitHub" },
  "submit.disconnect": { en: "Disconnect", fr: "Déconnexion" },
  "submit.creatingPr": { en: "Creating PR...", fr: "Création de la PR..." },
  "submit.prCreated": { en: "Pull Request Created", fr: "Pull Request créée" },
  "submit.submitted": { en: "{id} v{v} has been submitted.", fr: "{id} v{v} a été soumis." },
  "submit.viewOnGithub": { en: "View on GitHub", fr: "Voir sur GitHub" },

  // ── Settings ──
  "settings.label": { en: "Settings", fr: "Paramètres" },
  "settings.title": { en: "Settings", fr: "Paramètres" },
  "settings.desc": { en: "Configure UniCreate preferences.", fr: "Configurez les préférences d'UniCreate." },
  "settings.account": { en: "Account", fr: "Compte" },
  "settings.connectedAs": { en: "Connected as", fr: "Connecté en tant que" },
  "settings.savedSession": { en: "Saved session (persistent)", fr: "Session sauvegardée (persistante)" },
  "settings.ephemeralSession": { en: "Ephemeral session ({n} min)", fr: "Session éphémère ({n} min)" },
  "settings.disconnect": { en: "Disconnect", fr: "Déconnexion" },
  "settings.disconnectDesc": { en: "Remove saved token and sign out", fr: "Supprimer le token et se déconnecter" },
  "settings.notConnected": { en: "Not connected", fr: "Non connecté" },
  "settings.notConnectedDesc": { en: "Sign in from the top-right profile button", fr: "Connectez-vous via le bouton profil en haut à droite" },
  "settings.general": { en: "General", fr: "Général" },
  "settings.language": { en: "Language", fr: "Langue" },
  "settings.languageDesc": { en: "Interface language", fr: "Langue de l'interface" },
  "settings.defaultLocale": { en: "Default package locale", fr: "Locale par défaut du paquet" },
  "settings.defaultLocaleDesc": { en: "Pre-filled locale for new manifests", fr: "Locale pré-remplie pour les nouveaux manifestes" },
  "settings.updates": { en: "Updates", fr: "Mises à jour" },
  "settings.autoCheck": { en: "Auto-check for updates", fr: "Vérification auto des mises à jour" },
  "settings.autoCheckDesc": { en: "Check for new versions on app launch", fr: "Vérifier les nouvelles versions au démarrage" },
  "settings.history": { en: "History", fr: "Historique" },
  "settings.maxRecent": { en: "Max recent submissions", fr: "Nombre max de soumissions récentes" },
  "settings.maxRecentDesc": { en: "Number of submissions shown on home page", fr: "Nombre de soumissions affichées sur la page d'accueil" },
  "settings.currentHistory": { en: "Current history", fr: "Historique actuel" },
  "settings.submissions": { en: "{n} submission(s), {p} recent package(s)", fr: "{n} soumission(s), {p} paquet(s) récent(s)" },
  "settings.clear": { en: "Clear", fr: "Effacer" },
  "settings.confirm": { en: "Confirm", fr: "Confirmer" },
  "settings.about": { en: "About", fr: "À propos" },
  "settings.version": { en: "Version", fr: "Version" },
  "settings.github": { en: "GitHub", fr: "GitHub" },
  "settings.githubDesc": { en: "Source code and issues", fr: "Code source et problèmes" },
  "settings.repository": { en: "Repository", fr: "Dépôt" },
  "settings.neverSave": { en: "Never save session", fr: "Ne jamais sauvegarder la session" },
  "settings.neverSaveDesc": {
    en: "Force ephemeral sessions only. Token is never stored in the system keyring. Recommended for shared or enterprise machines.",
    fr: "Forcer les sessions éphémères uniquement. Le token n'est jamais stocké dans le trousseau système. Recommandé pour les machines partagées ou en entreprise.",
  },
  "settings.ephemeralTimeout": { en: "Session timeout", fr: "Durée de session" },
  "settings.ephemeralTimeoutDesc": { en: "Ephemeral session duration before auto-lock", fr: "Durée de la session éphémère avant verrouillage auto" },
  "settings.ephemeralMinutes": { en: "{n} min", fr: "{n} min" },
  "settings.tokenScope": { en: "Token scope", fr: "Portée du token" },
  "settings.tokenScopeDesc": { en: "Only public_repo — read/write access to public repositories only", fr: "Uniquement public_repo — accès lecture/écriture aux dépôts publics uniquement" },
  "settings.security": { en: "Security", fr: "Sécurité" },
  "settings.network": { en: "Network", fr: "Réseau" },
  "settings.proxy": { en: "HTTP Proxy", fr: "Proxy HTTP" },
  "settings.proxyDesc": { en: "Optional proxy URL (e.g. http://proxy:8080). Leave empty to use system settings.", fr: "URL du proxy (ex : http://proxy:8080). Laisser vide pour utiliser les paramètres système." },
  "settings.proxyPlaceholder": { en: "http://proxy:8080", fr: "http://proxy:8080" },
  "settings.auditLog": { en: "Audit log", fr: "Journal d'audit" },
  "settings.auditLogDesc": { en: "All submissions are logged locally for traceability", fr: "Toutes les soumissions sont enregistrées localement pour la traçabilité" },
  "settings.openAuditLog": { en: "Open log", fr: "Ouvrir le journal" },
  "settings.back": { en: "Back", fr: "Retour" },

  // ── Profile Button ──
  "profile.connect": { en: "Connect", fr: "Connexion" },
  "profile.savedSession": { en: "Saved session", fr: "Session sauvegardée" },
  "profile.ephemeralSession": { en: "Ephemeral session ({n} min)", fr: "Session éphémère ({n} min)" },
  "profile.recoverPrs": { en: "Recover PRs", fr: "Récupérer les PRs" },
  "profile.recovering": { en: "Recovering...", fr: "Récupération..." },
  "profile.disconnect": { en: "Disconnect", fr: "Déconnexion" },
  "profile.signIn": { en: "Sign in with GitHub", fr: "Se connecter avec GitHub" },
  "profile.deviceFlow": { en: "Use GitHub Device Flow", fr: "Utiliser GitHub Device Flow" },
  "profile.enterCode": { en: "Enter this code on GitHub:", fr: "Entrez ce code sur GitHub :" },
  "profile.waiting": { en: "Waiting for authorization...", fr: "En attente d'autorisation..." },
  "profile.openGithub": { en: "Open GitHub again", fr: "Ouvrir GitHub" },
  "profile.cancel": { en: "Cancel", fr: "Annuler" },
  "profile.remember": { en: "Remember session", fr: "Se souvenir de la session" },

  // ── Common ──
  "common.cancel": { en: "Cancel", fr: "Annuler" },
  "common.back": { en: "Back", fr: "Retour" },
  "common.continue": { en: "Continue", fr: "Continuer" },
  "common.update": { en: "UPDATE", fr: "MISE À JOUR" },
  "common.live": { en: "Live", fr: "Actif" },
  "common.sync": { en: "Sync", fr: "Sync" },

  // ── Update popup ──
  "update.available": { en: "Update available", fr: "Mise à jour disponible" },
  "update.isAvailable": {
    en: "UniCreate {v} is available",
    fr: "UniCreate {v} est disponible",
  },
  "update.currentVersion": { en: "Current version: {v}", fr: "Version actuelle : {v}" },
  "update.installer": { en: "Installer: {n}", fr: "Installeur : {n}" },
  "update.later": { en: "Later", fr: "Plus tard" },
  "update.update": { en: "Update", fr: "Mettre à jour" },
  "update.updating": { en: "Updating...", fr: "Mise à jour..." },
} as const;

export type TranslationKey = keyof typeof translations;

export function t(key: TranslationKey, lang: AppLanguage): string {
  const entry = translations[key];
  return entry?.[lang] ?? entry?.en ?? key;
}

/** React hook — returns a translator function bound to the current language. */
export function useT(): (key: TranslationKey, vars?: Record<string, string | number>) => string {
  const lang = useSettingsStore((s) => s.language);
  return (key: TranslationKey, vars?: Record<string, string | number>) => {
    let text = t(key, lang);
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replaceAll(`{${k}}`, String(v));
      }
    }
    return text;
  };
}
