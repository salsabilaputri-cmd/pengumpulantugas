import { createClient } from
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// =====================================
// KONFIGURASI SUPABASE
// =====================================

const SUPABASE_URL = "https://yeeobkitemrzbbocclhg.supabase.co";

// Tempel Publishable Key milikmu di sini
const SUPABASE_KEY = "sb_publishable_BAiRTK2MgIvSRA_SSW0isw_PONKdNaf";

const ADMIN_UID = "3329f78a-70b1-4ae3-9608-84cb76b46cac";
const BUCKET = "documents";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (id) => document.getElementById(id);

let documents = [];
let editingDocument = null;
let currentCategory = "Semua";

// =====================================
// FUNGSI BANTU
// =====================================

function showMessage(element, message, type = "") {
  if (!element) return;
  element.textContent = message;
  element.className = "message " + type;
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function formatDate(date) {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function formatFileSize(bytes) {
  if (!bytes) return "-";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(1) + " KB";
  }

  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function isAdminLoggedIn() {
  return !$("adminPanel").classList.contains("hidden");
}

// =====================================
// LOGIN ADMIN
// =====================================

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const button = $("loginBtn");
  button.disabled = true;
  button.textContent = "Logging in...";

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: $("email").value.trim(),
      password: $("password").value
    });

    if (error) throw error;

    if (data.user.id !== ADMIN_UID) {
      await supabase.auth.signOut();
      throw new Error("Akun ini bukan akun admin.");
    }

    showMessage($("loginMessage"), "Login berhasil! ♡", "success");

    await checkLogin();

  } catch (error) {
    showMessage($("loginMessage"), error.message, "error");

  } finally {
    button.disabled = false;
    button.textContent = "Login Admin ♡";
  }
});

// =====================================
// CEK STATUS LOGIN
// =====================================

async function checkLogin() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error(error);
  }

  const user = data.session?.user;
  const admin = user?.id === ADMIN_UID;

  $("loginPanel").classList.toggle("hidden", admin);
  $("adminPanel").classList.toggle("hidden", !admin);

  renderDocuments();
}

// =====================================
// LOGOUT
// =====================================

async function logout() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    alert(error.message);
    return;
  }

  resetForm();
  showMessage($("loginMessage"), "Kamu sudah logout.", "success");

  await checkLogin();
}

$("logoutBtn").addEventListener("click", logout);
$("sidebarLogout").addEventListener("click", logout);

// =====================================
// AMBIL DATA DARI SUPABASE
// =====================================

async function loadDocuments() {
  $("documentList").innerHTML =
    '<div class="empty-card">Loading documents... 🌷</div>';

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);

    $("documentList").innerHTML =
      '<div class="empty-card">Gagal memuat dokumen.</div>';

    return;
  }

  documents = data || [];

  updateStatistics();
  renderDocuments();
}

// =====================================
// STATISTIK
// =====================================

function updateStatistics() {
  $("totalDocuments").textContent = documents.length;

  $("totalMateri").textContent =
    documents.filter(doc =>
      doc.category?.toLowerCase() === "materi"
    ).length;

  $("totalTugas").textContent =
    documents.filter(doc =>
      doc.category?.toLowerCase() === "tugas"
    ).length;
}

// =====================================
// FILTER KATEGORI
// =====================================

function getSelectedCategory() {
  const value = $("filterCategory").value.toLowerCase();

  if (
    value === "semua" ||
    value === "all" ||
    value === "all categories"
  ) {
    return "Semua";
  }

  return value;
}

function setCategoryFilter(category) {
  currentCategory = category;

  const select = $("filterCategory");

  const option = [...select.options].find(item => {
    const value = item.value.toLowerCase();
    const text = item.textContent.toLowerCase();

    return value === category.toLowerCase() ||
      text === category.toLowerCase();
  });

  if (option) {
    select.value = option.value;
  }

  renderDocuments();
}

// =====================================
// MENU KIRI: TUGAS DAN MATERI TERPISAH
// =====================================

document.querySelectorAll(".nav-link").forEach(link => {
  link.addEventListener("click", event => {
    const label = link.textContent.toLowerCase();

    let category = null;

    if (label.includes("kumpulan tugas")) {
      category = "Tugas";
    }

    if (label.includes("materi kuliah")) {
      category = "Materi";
    }

    if (label.includes("home")) {
      category = "Semua";
    }

    if (category !== null) {
      event.preventDefault();

      setCategoryFilter(category);

      document.querySelectorAll(".nav-link").forEach(item => {
        item.classList.remove("active");
      });

      link.classList.add("active");

      $("documents").scrollIntoView({
        behavior: "smooth"
      });
    }
  });
});

// =====================================
// TAMPILKAN DOKUMEN
// =====================================

function renderDocuments() {
  const keyword = $("searchInput").value.toLowerCase().trim();
  const category = getSelectedCategory();
  const sorting = $("sortDocuments").value;

  const admin = isAdminLoggedIn();

  let filtered = documents.filter(doc => {
    const searchText = [
      doc.title,
      doc.description,
      doc.file_name
    ].join(" ").toLowerCase();

    const matchesSearch = searchText.includes(keyword);

    const matchesCategory =
      category === "Semua" ||
      doc.category?.toLowerCase() === category;

    return matchesSearch && matchesCategory;
  });

  // PENGURUTAN
  if (sorting === "newest") {
    filtered.sort((a, b) =>
      new Date(b.created_at) - new Date(a.created_at)
    );

  } else if (sorting === "oldest") {
    filtered.sort((a, b) =>
      new Date(a.created_at) - new Date(b.created_at)
    );

  } else if (sorting === "az") {
    filtered.sort((a, b) =>
      a.title.localeCompare(b.title)
    );

  } else if (sorting === "za") {
    filtered.sort((a, b) =>
      b.title.localeCompare(a.title)
    );
  }

  // JIKA KOSONG
  if (!filtered.length) {
    $("documentList").innerHTML =
      '<div class="empty-card">Belum ada dokumen di kategori ini. ♡</div>';

    return;
  }

  // TAMPILKAN KARTU DOKUMEN
  $("documentList").innerHTML = filtered.map(doc => {
    const categoryClass =
      doc.category === "Materi" ? "materi" : "";

    const downloadUrl = doc.file_url ||
      supabase.storage
        .from(BUCKET)
        .getPublicUrl(doc.file_path).data.publicUrl;

    return `
      <article class="document-card">

        <div class="document-card-top">
          <span class="category-badge ${categoryClass}">
            ${escapeHTML(doc.category)}
          </span>

          <span>🌷</span>
        </div>

        <h3>${escapeHTML(doc.title)}</h3>

        <p class="document-description">
          ${escapeHTML(doc.description || "Tidak ada deskripsi.")}
        </p>

        <div class="document-meta">
          <span>📎 ${escapeHTML(doc.file_name)}</span>
          <span>📦 ${formatFileSize(doc.file_size)}</span>
          <span>📅 Deadline: ${formatDate(doc.deadline)}</span>
          <span>🕒 Diunggah: ${formatDate(doc.created_at)}</span>
        </div>

        <div class="document-actions">

          <a
            href="${escapeHTML(downloadUrl)}"
            target="_blank"
            rel="noopener noreferrer"
            class="download-btn"
          >
            Download ♡
          </a>

          ${admin ? `
            <button
              class="edit-btn"
              data-action="edit"
              data-id="${doc.id}"
            >
              Edit
            </button>

            <button
              class="delete-btn"
              data-action="delete"
              data-id="${doc.id}"
            >
              Hapus
            </button>
          ` : ""}

        </div>

      </article>
    `;
  }).join("");
}

// =====================================
// SEARCH, FILTER, DAN SORT
// =====================================

$("searchInput").addEventListener("input", renderDocuments);

$("filterCategory").addEventListener("change", () => {
  currentCategory = getSelectedCategory();
  renderDocuments();
});

$("sortDocuments").addEventListener("change", renderDocuments);

// =====================================
// UPLOAD DOKUMEN
// =====================================

$("uploadForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const button = $("submitBtn");
  const isEditing = Boolean(editingDocument);

  button.disabled = true;
  button.textContent = "Menyimpan...";

  let uploadedPath = null;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;

    if (!user || user.id !== ADMIN_UID) {
      throw new Error("Silakan login sebagai admin.");
    }

    const title = $("title").value.trim();
    const description = $("description").value.trim();
    const category = $("category").value;
    const deadline = $("deadline").value || null;
    const file = $("file").files[0];

    if (!title || !category) {
      throw new Error("Judul dan kategori wajib diisi.");
    }

    if (!isEditing && !file) {
      throw new Error("Silakan pilih file.");
    }

    const fileData = {};

    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        throw new Error("Ukuran file maksimal 50 MB.");
      }

      const safeName = file.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );

      const path =
        `${Date.now()}-${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file);

      if (uploadError) throw uploadError;

      uploadedPath = path;

      const { data: publicData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(path);

      Object.assign(fileData, {
        file_name: file.name,
        file_path: path,
        file_url: publicData.publicUrl,
        file_type: file.type || "application/octet-stream",
        file_size: file.size
      });
    }

    const documentData = {
      title,
      description,
      category,
      deadline,
      ...fileData
    };

    if (isEditing) {
      const { error } = await supabase
        .from("documents")
        .update({
          ...documentData,
          updated_at: new Date().toISOString()
        })
        .eq("id", editingDocument.id);

      if (error) throw error;

      if (file && editingDocument.file_path) {
        const { error: removeError } = await supabase.storage
          .from(BUCKET)
          .remove([editingDocument.file_path]);

        if (removeError) {
          console.error(removeError);
        }
      }

    } else {
      const { error } = await supabase
        .from("documents")
        .insert([documentData]);

      if (error) throw error;
    }

    resetForm();

    await loadDocuments();

    showMessage(
      $("uploadMessage"),
      isEditing
        ? "Dokumen berhasil diperbarui! 💗"
        : "Dokumen berhasil diupload! 🌷",
      "success"
    );

  } catch (error) {
    console.error(error);

    if (uploadedPath) {
      await supabase.storage
        .from(BUCKET)
        .remove([uploadedPath]);
    }

    showMessage(
      $("uploadMessage"),
      "Gagal: " + error.message,
      "error"
    );

  } finally {
    button.disabled = false;

    button.textContent = editingDocument
      ? "Simpan Perubahan ♡"
      : "Upload Document ♡";
  }
});

// =====================================
// TOMBOL EDIT DAN HAPUS
// =====================================

$("documentList").addEventListener("click", async event => {
  const button = event.target.closest("button[data-action]");

  if (!button) return;

  const doc = documents.find(item =>
    item.id === button.dataset.id
  );

  if (!doc) return;

  if (button.dataset.action === "edit") {
    startEdit(doc);
  }

  if (button.dataset.action === "delete") {
    await deleteDocument(doc);
  }
});

// =====================================
// EDIT DOKUMEN
// =====================================

function startEdit(doc) {
  editingDocument = doc;

  $("documentId").value = doc.id;
  $("title").value = doc.title;
  $("description").value = doc.description || "";
  $("category").value = doc.category;
  $("deadline").value = doc.deadline || "";
  $("file").value = "";

  $("formTitle").textContent = "Edit Document ✨";
  $("submitBtn").textContent = "Simpan Perubahan ♡";

  $("cancelEditBtn").classList.remove("hidden");

  showMessage(
    $("uploadMessage"),
    "Silakan ubah informasi dokumen."
  );

  $("admin").scrollIntoView({
    behavior: "smooth"
  });
}

// =====================================
// HAPUS DOKUMEN
// =====================================

async function deleteDocument(doc) {
  if (!confirm(`Yakin ingin menghapus "${doc.title}"?`)) {
    return;
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;

    if (!user || user.id !== ADMIN_UID) {
      throw new Error("Hanya admin yang boleh menghapus.");
    }

    const { error } = await supabase
      .from("documents")
      .delete()
      .eq("id", doc.id);

    if (error) throw error;

    if (doc.file_path) {
      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .remove([doc.file_path]);

      if (storageError) {
        console.error(storageError);
      }
    }

    alert("Dokumen berhasil dihapus! ♡");

    await loadDocuments();

  } catch (error) {
    alert("Gagal menghapus: " + error.message);
    console.error(error);
  }
}

// =====================================
// RESET FORM
// =====================================

function resetForm() {
  $("uploadForm").reset();

  editingDocument = null;

  $("documentId").value = "";
  $("formTitle").textContent = "Add New Document ✨";
  $("submitBtn").textContent = "Upload Document ♡";

  $("cancelEditBtn").classList.add("hidden");
}

$("cancelEditBtn").addEventListener("click", () => {
  resetForm();

  showMessage(
    $("uploadMessage"),
    "Edit dibatalkan."
  );
});

// =====================================
// MULAI WEBSITE
// =====================================

async function initializeApp() {
  await checkLogin();
  await loadDocuments();
}

initializeApp();