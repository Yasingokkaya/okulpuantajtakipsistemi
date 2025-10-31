 import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
            import { getFirestore, collection, addDoc, getDocs, doc, getDoc, setDoc, deleteDoc, query, where, orderBy, documentId, limit, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
            import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
            import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

            const firebaseConfig = {
                apiKey: "AIzaSyBoSgNHT05FNKeswV0KCaKY4-Pz7jpwbXM",
                authDomain: "puantaj-fe3df.firebaseapp.com",
                projectId: "puantaj-fe3df",
                storageBucket: "puantaj-fe3df.appspot.com",
                messagingSenderId: "110213592906",
                appId: "1:110213592906:web:02a14675741fc63e15b3b3",
                measurementId: "G-JC71J8VRJW"
            };

            const app = initializeApp(firebaseConfig);
            const db = getFirestore(app);
            const functions = getFunctions(app);
            window.firebaseFunctions = functions;
            window.httpsCallable = httpsCallable;
            let currentUserOkulId = null;
            let isCurrentUserSuperAdmin = false;

            const auth = getAuth(app);
            window.auth = auth;

            const COLOR_PALETTE = [
                'hsl(25, 90%, 73%)',
                'hsl(45, 90%, 73%)',
                'hsl(80, 80%, 70%)',
                'hsl(160, 80%, 70%)',
                'hsl(195, 80%, 70%)',
                'hsl(220, 90%, 75%)',
                'hsl(275, 80%, 75%)',
                'hsl(340, 90%, 78%)',
                'hsl(5, 85%, 75%)',
                'hsl(130, 75%, 70%)',
                'hsl(300, 80%, 75%)',
                'hsl(200, 90%, 80%)'
            ];



            async function handleAdminsListClick(e) {
                const button = e.target.closest('button');
                if (!button) return;

                const action = button.dataset.action;
                const uid = button.dataset.uid;
                const email = button.dataset.email;
                const okulId = button.dataset.okulId;
                const okulAdi = button.dataset.okulAdi;

                if (action === 'edit-password') {
                    openPasswordModal(uid, email);
                }

                if (action === 'delete-admin') {
                    showConfirmationModal(
                        `<strong>${email}</strong> e-posta adresli yöneticiyi kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`,
                        async () => {
                            showSpinner();
                            try {
                                const kullaniciSil = httpsCallable(functions, 'kullaniciSil');
                                await kullaniciSil({ uid: uid });
                                showToast(`Yönetici (${email}) başarıyla silindi.`, 'success');
                                await renderAllAdminsList();
                            } catch (error) {
                                console.error("Yönetici silinirken Firebase Function hatası:", error);
                                showToast(`Yönetici silinirken bir hata oluştu: ${error.message}`, 'error');
                            } finally {
                                hideSpinner();
                            }
                        }
                    );
                }

                if (action === 'toggle-status') {
                    showSpinner();
                    try {
                        const okulDocRef = doc(db, "okullar", okulId);
                        const okulDoc = await getDoc(okulDocRef);
                        const yeniDurum = okulDoc.data().durum === 'pasif' ? 'aktif' : 'pasif';
                        await updateDoc(okulDocRef, { durum: yeniDurum });
                        showToast('Okul durumu güncellendi.', 'success');
                        await renderAllAdminsList();
                        await populateSchoolsDropdown();
                    } catch (error) {
                        console.error("Okul durumu güncellenirken hata:", error);
                        showToast('Okul durumu güncellenemedi.', 'error');
                    } finally {
                        hideSpinner();
                    }
                }

                if (action === 'delete-school') {
                    showConfirmationModal(
                        `<strong>DİKKAT!</strong><br><br><strong>${okulAdi}</strong> adlı okulu ve bağlı yöneticileri kalıcı olarak silmek üzeresiniz. Bu işlem geri alınamaz.`,
                        async () => {
                            showSpinner();
                            try {
                                const okuluSil = httpsCallable(functions, 'okuluSil');
                                await okuluSil({ okulId: okulId });
                                showToast(`Okul (${okulAdi}) ve bağlı yöneticiler silindi.`, 'success');
                                await renderAllAdminsList();
                                await populateSchoolsDropdown();
                            } catch (error) {
                                console.error("Okul silinirken Firebase Function hatası:", error);
                                showToast(`Okul silinirken bir hata oluştu: ${error.message}`, 'error');
                            } finally {
                                hideSpinner();
                            }
                        }
                    );
                }
            }


            function initializeSuperAdminPanel() {
                const newSchoolForm = document.getElementById('newSchoolForm');
                newSchoolForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const okulAdiInput = document.getElementById('newSchoolName');
                    const okulAdi = okulAdiInput.value.trim();

                    if (!okulAdi) {
                        showToast('Okul adı boş bırakılamaz.', 'error');
                        return;
                    }

                    try {
                        showSpinner();
                        await addDoc(collection(db, "okullar"), {
                            adi: okulAdi
                        });
                        showToast(`'${okulAdi}' adlı okul başarıyla eklendi.`, 'success');
                        okulAdiInput.value = '';
                        populateSchoolsDropdown();
                        renderAllAdminsList();
                    } catch (error) {
                        console.error("Yeni okul eklenirken hata:", error);
                        showToast('Okul eklenirken bir hata oluştu.', 'error');
                    } finally {
                        hideSpinner();
                    }
                });

                populateSchoolsDropdown();
                renderAllAdminsList();

                const newUserForm = document.getElementById('newUserForm');


                if (!newUserForm.dataset.listenerAttached) {
                    newUserForm.addEventListener('submit', async (e) => {
                        e.preventDefault();
                        const email = document.getElementById('newUserEmail').value;
                        const password = document.getElementById('newUserPassword').value;
                        const okulId = document.getElementById('schoolSelect').value;
                        const statusDiv = document.getElementById('newUserStatus');

                        if (!email || !password || !okulId) {
                            statusDiv.textContent = 'Lütfen tüm alanları doldurun.';
                            statusDiv.style.color = 'red';
                            return;
                        }

                        statusDiv.textContent = 'Kullanıcı oluşturuluyor, lütfen bekleyin...';
                        statusDiv.style.color = 'orange';


                        const yeniKullaniciOlustur = httpsCallable(functions, 'yeniKullaniciOlustur');
                        try {
                            const result = await yeniKullaniciOlustur({
                                email: email,
                                password: password,
                                okulId: okulId,
                                rol: 'admin'
                            });
                            statusDiv.textContent = result.data.result;
                            statusDiv.style.color = 'green';
                            newUserForm.reset();
                            renderAllAdminsList();
                        } catch (error) {
                            console.error('Cloud function hatası:', error);
                            statusDiv.textContent = `Hata: ${error.message}`;
                            statusDiv.style.color = 'red';
                        }
                    });


                    newUserForm.dataset.listenerAttached = 'true';
                }

                const adminListContainer = document.getElementById('all-admins-list-container');
                if (adminListContainer && !adminListContainer.dataset.listenerAttached) {
                    adminListContainer.addEventListener('click', handleAdminsListClick);
                    adminListContainer.dataset.listenerAttached = 'true';
                }
            }


            async function renderAllAdminsList() {
                const container = document.getElementById('all-admins-list-container');
                container.style.display = 'grid';
                container.style.gridTemplateColumns = 'repeat(auto-fit, minmax(450px, 1fr))';
                container.innerHTML = '<p style="grid-column: 1 / -1;">Yönetici listesi yükleniyor...</p>';

                const tumOkullariListele = httpsCallable(functions, 'tumOkullariListele');

                try {
                    const result = await tumOkullariListele();
                    const okullar = result.data.okullar;

                    if (!okullar || okullar.length === 0) {
                        container.innerHTML = '<p>Görüntülenecek okul veya yönetici bulunamadı.</p>';
                        return;
                    }


                    const aktifOkullar = okullar.filter(okul => okul.durum !== 'pasif').sort((a, b) => (a.adi || '').localeCompare(b.adi || ''));
                    const pasifOkullar = okullar.filter(okul => okul.durum === 'pasif').sort((a, b) => (a.adi || '').localeCompare(b.adi || ''));

                    let html = '';

                    const generateOkulHTML = (okul) => {
                        const okulAdi = okul.adi || 'İSİMSİZ OKUL'; // Boş isimlere karşı ek bir önlem
                        const isPassive = okul.durum === 'pasif';
                        const statusLabel = isPassive ? '<span style="color: #e74c3c; font-weight: bold;">(Pasif)</span>' : '';
                        const toggleStatusBtnText = isPassive ? 'Aktif Yap' : 'Pasif Yap';
                        const toggleStatusBtnClass = isPassive ? 'btn-add' : 'btn-edit';

                        let okulHTML = `
            <div class="kontrol-paneli-bolumu" style="margin-bottom: 20px; ${isPassive ? 'background-color: #fceae8;' : ''}">
                <div style="display:flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 15px;">
                     <h4 style="margin: 0; color: var(--theme-primary);">
                        ${okulAdi} ${statusLabel}
                     </h4>
                     <div style="display: flex; gap: 8px;">
                        <button class="btn ${toggleStatusBtnClass}" data-okul-id="${okul.id}" data-action="toggle-status" style="font-size: 12px; padding: 5px 10px;">${toggleStatusBtnText}</button>
                        <button class="btn btn-delete" data-okul-id="${okul.id}" data-okul-adi="${okulAdi}" data-action="delete-school" style="font-size: 12px; padding: 5px 10px;">Okulu Sil</button>
                     </div>
                </div>`;

                        if (okul.admins && okul.admins.length > 0) {
                            okulHTML += '<ul class="settings-list" style="margin-top: 0;">';
                            okul.admins.forEach(admin => {
                                okulHTML += `
                    <li style="display: flex; justify-content: space-between; align-items: center; padding: 10px;">
                        <span>${admin.email}</span>
                        <div style="display: flex; gap: 10px;">
                            <button class="btn btn-edit-password" data-uid="${admin.uid}" data-email="${admin.email}" data-action="edit-password" style="font-size: 12px; padding: 5px 10px; background-color: var(--theme-accent);">Şifre Değiştir</button>
                            <button class="btn btn-delete" data-uid="${admin.uid}" data-email="${admin.email}" data-action="delete-admin" style="font-size: 12px; padding: 5px 10px;">Yöneticiyi Sil</button>
                        </div>
                    </li>`;
                            });
                            okulHTML += '</ul>';
                        } else {
                            okulHTML += '<p style="font-style: italic; color: #666;">Bu okula atanmış bir yönetici bulunmuyor.</p>';
                        }
                        okulHTML += '</div>';
                        return okulHTML;
                    };

                    if (aktifOkullar.length > 0) {
                        html += '<div style="grid-column: 1 / -1;"><h3>Aktif Okullar</h3></div>';
                        aktifOkullar.forEach(okul => html += generateOkulHTML(okul));
                    }

                    if (pasifOkullar.length > 0) {
                        html += '<div style="grid-column: 1 / -1; margin-top: 20px; border-top: 2px solid #ccc; padding-top: 10px;"><h3>Pasif Okullar</h3></div>';
                        pasifOkullar.forEach(okul => html += generateOkulHTML(okul));
                    }

                    container.innerHTML = html;

                } catch (error) {
                    console.error("Yönetici listesi çekilirken hata:", error);
                    document.getElementById('all-admins-list-container').innerHTML = `<p style="color: red;">Yönetici listesi yüklenemedi: ${error.message}</p>`;
                }
            }


            async function populateSchoolsDropdown() {
                const select = document.getElementById('schoolSelect');
                try {
                    const q = query(collection(db, "okullar"), where("durum", "!=", "pasif"), orderBy("adi"));
                    const querySnapshot = await getDocs(q);

                    select.innerHTML = '<option value="">Lütfen bir okul seçin...</option>';

                    querySnapshot.forEach((doc) => {
                        const okulAdi = doc.data().adi;
                        const okulId = doc.id;
                        const option = new Option(okulAdi, okulId);
                        select.add(option);
                    });
                } catch (error) {
                    console.error("Okullar yüklenirken hata:", error);
                    select.innerHTML = '<option value="">Okullar yüklenemedi!</option>';
                }
            }

            function openPasswordModal(uid, email) {
                const modal = document.getElementById('edit-password-modal');
                const form = document.getElementById('edit-password-form');

                document.getElementById('edit-password-modal-title').textContent = `Şifreyi Değiştir: ${email}`;
                document.getElementById('edit-password-uid').value = uid;
                form.reset();
                modal.classList.add('open');
            }

            document.getElementById('edit-password-form').addEventListener('submit', async (e) => {
                e.preventDefault();

                const uid = document.getElementById('edit-password-uid').value;
                const newPassword = document.getElementById('new-password').value;
                const confirmPassword = document.getElementById('confirm-password').value;

                if (newPassword.length < 6) {
                    showToast('Şifre en az 6 karakter olmalıdır.', 'error');
                    return;
                }
                if (newPassword !== confirmPassword) {
                    showToast('Girdiğiniz şifreler uyuşmuyor.', 'error');
                    return;
                }

                showToast('Şifre güncelleniyor...', 'info');
                const sifreGuncelle = httpsCallable(functions, 'sifreGuncelle');

                try {
                    const result = await sifreGuncelle({ uid: uid, newPassword: newPassword });
                    showToast(result.data.result, 'success');
                    document.getElementById('edit-password-modal').classList.remove('open');
                } catch (error) {
                    console.error('Şifre güncelleme hatası:', error);
                    showToast(`Hata: ${error.message}`, 'error');
                }
            });

            document.querySelectorAll('.modal .close-modal').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.target.closest('.modal').classList.remove('open');
                });
            });


            function initializeMobileMenu() {
                const hamburgerBtn = document.getElementById('hamburger-btn');
                const sidebar = document.querySelector('.sidebar');
                const overlay = document.getElementById('sidebar-overlay');
                const navLinks = document.querySelectorAll('.sidebar .nav-link, .sidebar .sub-menu a');

                if (!hamburgerBtn || !sidebar || !overlay) return;

                const closeMenu = () => {
                    sidebar.classList.remove('open');
                    overlay.style.display = 'none';
                };

                const openMenu = () => {
                    sidebar.classList.add('open');
                    overlay.style.display = 'block';
                };

                hamburgerBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (sidebar.classList.contains('open')) {
                        closeMenu();
                    } else {
                        openMenu();
                    }
                });

                overlay.addEventListener('click', closeMenu);

                navLinks.forEach(link => {
                    link.addEventListener('click', () => {
                        if (window.innerWidth <= 768) {
                            closeMenu();
                        }
                    });
                });
            }

            let isAppInitialized = false;
            function initializeApplicationUI() {
                if (isAppInitialized) return;

                const modal = document.getElementById('add-staff-modal');
                const personelForm = document.getElementById('personelForm');
                const openModal = (staffId = null, staffData = {}) => {
                    loadPersonelForm(staffId, staffData);
                    modal.classList.add('open');
                };
                const closeModal = () => modal.classList.remove('open');
                document.getElementById('open-add-staff-modal').addEventListener('click', () => openModal());
                document.getElementById('add-staff-from-list-btn').addEventListener('click', () => openModal());
                modal.querySelector('.close-modal').addEventListener('click', closeModal);
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) closeModal();
                });

                document.querySelectorAll('.nav-link').forEach(link => {
                    if (link.id === 'open-add-staff-modal') return;
                    link.addEventListener('click', function (e) {
                        const targetId = this.dataset.target;


                        const okulGerektirenModuller = ['staff-list', 'ders-programi', 'gorevlendirme', 'nobet-takip', 'izin-takip', 'puantaj', 'settings'];
                        if (isCurrentUserSuperAdmin && !currentUserOkulId && okulGerektirenModuller.includes(targetId)) {
                            e.preventDefault();
                            e.stopPropagation();
                            showToast('Lütfen devam etmek için sol üst menüden bir okul seçin.', 'error');
                            return;
                        }

                        if (this.classList.contains('accordion-trigger')) {
                            e.preventDefault();
                            this.parentElement.classList.toggle('open');
                        }

                        if (targetId) {
                            e.preventDefault();
                            document.querySelectorAll('.nav-link, .accordion-trigger, .module').forEach(el => el.classList.remove('active'));
                            this.classList.add('active');
                            const parentGroup = this.closest('.menu-item-group');
                            if (parentGroup) {
                                parentGroup.querySelector('.accordion-trigger').classList.add('active');
                            }
                            document.getElementById(targetId).classList.add('active');
                            if (targetId === 'dashboard') renderDashboardData();
                            if (targetId === 'staff-list') fetchStaff();
                            if (targetId === 'settings') initializeSettings();
                            if (targetId === 'gorevlendirme') initializeGorevlendirme();
                            if (targetId === 'nobet-takip') initializeNobetTakip();
                            if (targetId === 'puantaj') initializePuantaj();
                            if (targetId === 'izin-takip') initializeIzinTakip();
                            if (targetId === 'ders-programi') initializeSchedule();
                            if (targetId === 'super-admin-panel') initializeSuperAdminPanel();
                        }
                    });
                });


                personelForm.addEventListener('submit', async function (e) {
                    e.preventDefault();
                    showSpinner();
                    const editingId = e.target.dataset.editingId;
                    const formData = new FormData(e.target);
                    const data = Object.fromEntries(formData.entries());
                    data.okulId = currentUserOkulId;

                    if (data.sozlesme_turu === 'Kısmi Süreli') {
                        data.kismi_zamanli_calisma = {};
                        const gunler = formData.getAll('kismi_gunler');
                        const gunMap = { 'Pazartesi': 'pzts_saat', 'Salı': 'sali_saat', 'Çarşamba': 'crs_saat', 'Perşembe': 'prs_saat', 'Cuma': 'cuma_saat', 'Cumartesi': 'cmrts_saat', 'Pazar': 'pazar_saat' };
                        gunler.forEach(gunAdi => {
                            const saatInputAdi = gunMap[gunAdi];
                            if (saatInputAdi && data[saatInputAdi]) {
                                const saatDegeri = parseInt(data[saatInputAdi], 10);
                                if (!isNaN(saatDegeri)) { data.kismi_zamanli_calisma[gunAdi] = saatDegeri; }
                            }
                        });
                        delete data.kismi_gunler;
                        Object.values(gunMap).forEach(inputAdi => delete data[inputAdi]);
                    }

                    try {
                        if (editingId) {
                            const personelRef = doc(db, "personel", editingId);
                            const docSnap = await getDoc(personelRef);
                            if (docSnap.exists()) {
                                const oldData = docSnap.data();
                                const degisiklikTarihi = data.degisiklik_tarihi;
                                if ((oldData.gorevi_bransi !== data.gorevi_bransi || oldData.sozlesme_turu !== data.sozlesme_turu) && degisiklikTarihi) {
                                    await updateHizmetGecmisi(editingId, data, degisiklikTarihi, oldData);
                                }
                            }

                            delete data.degisiklik_tarihi;

                            await setDoc(personelRef, data, { merge: true });
                            showToast('Personel başarıyla güncellendi.');
                        } else {
                            const newDocRef = await addDoc(collection(db, "personel"), data);
                            await createInitialHizmetGecmisi(newDocRef.id, data);
                            showToast('Personel başarıyla eklendi.');
                        }
                        closeModal();
                        tumPersonelListesi = [];
                        if (document.getElementById('staff-list').classList.contains('active')) {
                            await fetchStaff();
                        }
                        await loadAndFilterPersonelList();
                    } catch (err) {
                        showToast('İşlem sırasında bir hata oluştu. Lütfen tekrar deneyin.', 'error');
                        console.error("Personel kaydetme/güncelleme hatası:", err);
                    } finally {
                        hideSpinner();
                    }
                });

                const personelDetayModal = document.getElementById('personel-detay-modal');
                document.getElementById('staff-list').addEventListener('click', (e) => {
                    if (e.target.classList.contains('btn-details')) {
                        const personelId = e.target.dataset.id;
                        openPersonelDetayModal(personelId);
                    }
                });
                personelDetayModal.querySelector('.close-modal').addEventListener('click', () => {
                    personelDetayModal.classList.remove('open');
                });
                personelDetayModal.addEventListener('click', (e) => {
                    if (e.target === personelDetayModal) {
                        personelDetayModal.classList.remove('open');
                    }
                });
                document.getElementById('personel-detay-tabs').addEventListener('click', e => {
                    if (e.target.matches('.settings-tab-button')) {
                        const targetTabId = e.target.dataset.tab;
                        personelDetayModal.querySelectorAll('.settings-tab-button, .settings-tab-content').forEach(el => {
                            el.classList.remove('active');
                        });
                        e.target.classList.add('active');
                        document.getElementById(targetTabId).classList.add('active');
                    }
                });
                document.getElementById('staff-list').addEventListener('click', async (e) => {
                    if (e.target.classList.contains('btn-delete')) {
                        const personelId = e.target.dataset.id;
                        const personelAdi = e.target.closest('tr').querySelector('td:nth-child(2)').textContent.trim();
                        showConfirmationModal(
                            `<strong>${personelAdi}</strong> adlı personeli kalıcı olarak silmek istediğinizden emin misiniz?`,
                            async () => {
                                await deleteDoc(doc(db, 'personel', personelId));


                                const index = tumPersonelListesi.findIndex(p => p.id === personelId);
                                if (index > -1) {
                                    tumPersonelListesi.splice(index, 1);
                                }

                                showToast('Personel silindi.');


                                await renderPersonelListesi();
                            }
                        );
                    }
                    if (e.target.classList.contains('btn-edit')) {
                        const docSnap = await getDoc(doc(db, 'personel', e.target.dataset.id));
                        if (docSnap.exists()) openModal(docSnap.id, docSnap.data());
                    }
                });
                document.getElementById('ekleBtn').addEventListener('click', addLesson);
                initializeMobileMenu();

                isAppInitialized = true;
            }

            let puantajInitialized = false;
            let puantajPersonelList = [];
            let puantajData = {};
            let overtimeReasons = {};
            let missingDayCodes = {};
            let isPuantajLocked = false;
            let currentPuantajDocRef = null;

            function openEditModal(personelId, date) {
                const dayData = puantajData[personelId]?.dailyData?.[date] || { code: '', hours: 0, notes: '' };
                const modalStatusSelect = document.getElementById('modal-status');
                const modalHoursInput = document.getElementById('modal-hours');
                const modalNotesInput = document.getElementById('modal-notes');
                const modalSaveBtn = document.getElementById('modal-save');
                const modalTitle = document.getElementById('p-modal-title');
                modalStatusSelect.value = dayData.code;
                modalHoursInput.value = dayData.hours;
                modalNotesInput.value = dayData.notes || '';
                modalSaveBtn.dataset.personelId = personelId;
                modalSaveBtn.dataset.date = date;
                const personelAdi = puantajData[personelId]?.ad || 'Personel';
                const tarihTR = new Date(date + 'T00:00:00').toLocaleDateString('tr-TR');
                modalTitle.textContent = `${personelAdi} - ${tarihTR} Günü Düzenle`;
                document.getElementById('edit-modal-overlay').style.display = 'block';
            }

            async function saveModalChanges() {
                const modalSaveBtn = document.getElementById('modal-save');
                const personelId = modalSaveBtn.dataset.personelId;
                const date = modalSaveBtn.dataset.date;
                if (!personelId || !date) {
                    showToast('Veri kaydedilirken bir hata oluştu.', 'error');
                    return;
                }
                const newCode = document.getElementById('modal-status').value;
                const newHours = parseFloat(document.getElementById('modal-hours').value) || 0;
                const newNotes = document.getElementById('modal-notes').value;

                if (!puantajData[personelId].dailyData) {
                    puantajData[personelId].dailyData = {};
                }
                puantajData[personelId].dailyData[date] = {
                    code: newCode,
                    hours: newHours,
                    notes: newNotes
                };
                updateTableCell(personelId, date);

                document.getElementById('edit-modal-overlay').style.display = 'none';
                showToast('Değişiklik yapıldı. Kalıcı olması için "Kaydet" butonuna tıklayın.', 'info');
            }

            async function fetchAndProcessSchedules() {
                const personelSchedules = {};
                if (!window.teacherList || !window.classList) {
                    console.error("Öğretmen veya Sınıf listesi yüklenemedi. Program verileri alınamıyor.");
                    return personelSchedules;
                }

                const teacherNameToIdMap = new Map(window.teacherList.map(t => [t.name, t.id]));
                const schedulesByVersionDate = {}; // Saatleri biriktirmek için ana yapı
                const classVersionPromises = window.classList.map(async (className) => {
                    const sanitizedSinifAdi = `${currentUserOkulId}_${className.replace(/\//g, '-')}`;
                    const versionsRef = collection(db, "ders_programlari", sanitizedSinifAdi, "versiyonlar");
                    const snapshot = await getDocs(versionsRef);
                    return snapshot.docs;
                });

                const allVersionDocs = (await Promise.all(classVersionPromises)).flat();
                for (const versionDoc of allVersionDocs) {
                    const etkinTarih = versionDoc.id;
                    const scheduleData = versionDoc.data();
                    if (!schedulesByVersionDate[etkinTarih]) {
                        schedulesByVersionDate[etkinTarih] = {};
                    }

                    for (const gun in scheduleData) {
                        if (["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"].includes(gun)) {
                            for (const saat in scheduleData[gun]) {
                                const dersData = scheduleData[gun][saat];
                                const ogretmenId = teacherNameToIdMap.get(dersData.ogretmen);

                                if (ogretmenId) {
                                    if (!schedulesByVersionDate[etkinTarih][ogretmenId]) {
                                        schedulesByVersionDate[etkinTarih][ogretmenId] = { Pazartesi: 0, Salı: 0, Çarşamba: 0, Perşembe: 0, Cuma: 0, Cumartesi: 0, Pazar: 0 };
                                    }
                                    schedulesByVersionDate[etkinTarih][ogretmenId][gun]++;
                                }
                            }
                        }
                    }
                }
                for (const tarih in schedulesByVersionDate) {
                    for (const ogretmenId in schedulesByVersionDate[tarih]) {
                        if (!personelSchedules[ogretmenId]) {
                            personelSchedules[ogretmenId] = [];
                        }
                        personelSchedules[ogretmenId].push({
                            tarih: tarih,
                            gunlukSaatler: schedulesByVersionDate[tarih][ogretmenId]
                        });
                    }
                }
                for (const ogretmenId in personelSchedules) {
                    personelSchedules[ogretmenId].sort((a, b) => new Date(b.tarih) - new Date(a.tarih));
                }

                return personelSchedules;
            }


            async function generateInitialPuantaj() {
                if (isPuantajLocked) {
                    showToast('Puantaj kilitli olduğu için oluşturulamaz.', 'error');
                    return;
                }

                try {
                    showSpinner();
                    const year = parseInt(document.getElementById('input-year').value);
                    const month = parseInt(document.getElementById('select-month').value);
                    showToast('Puantaj oluşturuluyor...', 'info');
                    const ayAdi = document.getElementById('select-month').options[month].text;
                    const okulAdi = await getCurrentSchoolName();
                    const baslikMetni = `${okulAdi.toLocaleUpperCase('tr-TR')} ${year} YILI ${ayAdi.toLocaleUpperCase('tr-TR')} AYI PERSONEL PUANTAJ CETVELİ`;

                    const personelPeriods = await getPersonelPeriodsForMonth(year, month);
                    let aktifPersonelList = personelPeriods;

                    const selectedPersonelId = document.getElementById('personel-filter-select').value;
                    if (selectedPersonelId !== 'all') {
                        aktifPersonelList = personelPeriods.filter(p => p.id === selectedPersonelId);
                    }

                    const [personelScheduleData, nobetVerisi, izinVerisi, [asilOgretmenGorevMap, gorevliOgretmenGorevMap]] = await Promise.all([
                        fetchAndProcessSchedules(),
                        fetchAndCalculateNobetData(year, month),
                        fetchIzinDataForPuantaj(year, month),
                        fetchGorevlendirmeDataForPuantaj(year, month)
                    ]);

                    const gunlerTR = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
                    puantajData = {};

                    aktifPersonelList.forEach(period => {
                        const personel = period;
                        const uniquePeriodId = period.uniquePeriodId;
                        puantajData[uniquePeriodId] = { ...personel, dailyData: {} };

                        const daysInMonth = new Date(year, month + 1, 0).getDate();
                        const periodStartDate = new Date(period.effectiveStartDate + 'T00:00:00Z');
                        const periodEndDate = new Date(period.effectiveEndDate + 'T00:00:00Z');

                        for (let day = 1; day <= daysInMonth; day++) {
                            const dateUTC = new Date(Date.UTC(year, month, day));
                            const dateString = dateUTC.toISOString().split('T')[0];

                            if (dateUTC < periodStartDate || dateUTC > periodEndDate) {
                                puantajData[uniquePeriodId]['dailyData'][dateString] = { code: '', hours: 0, notes: '' };
                                continue;
                            }

                            const iseGirisTarihiStr = personel.ise_giris;
                            if (iseGirisTarihiStr) {
                                const iseGirisTarihiUTC = new Date(iseGirisTarihiStr + 'T00:00:00Z');
                                if (dateUTC < iseGirisTarihiUTC) {
                                    puantajData[uniquePeriodId]['dailyData'][dateString] = { code: '', hours: 0, notes: '' };
                                    continue;
                                }
                            }

                            const anlikSozlesmeTuru = personel.sozlesme_turu;

                            let code = '', hours = 0;
                            const dayOfWeekTR = gunlerTR[dateUTC.getDay()];
                            const isEgitimPersoneli = personel.neviAdi && personel.neviAdi.includes('Eğitim Personeli');

                            if (anlikSozlesmeTuru && anlikSozlesmeTuru.includes('Kısmi')) {
                                if (isResmiTatil(dateUTC)) {
                                    code = 'E'; // Resmi tatilse Kısmi Süreli için 'E' ata
                                    hours = 0;
                                } else {
                                    let calismaSaati = 0;
                                    if (isEgitimPersoneli) {
                                        const gecerliProgramVersiyonu = personelScheduleData[personel.id]?.find(v => v.tarih <= dateString);
                                        calismaSaati = gecerliProgramVersiyonu?.gunlukSaatler?.[dayOfWeekTR] || 0;
                                    } else {
                                        calismaSaati = parseInt(personel.kismi_zamanli_calisma?.[dayOfWeekTR] || 0);
                                    }

                                    if (calismaSaati > 0) {
                                        code = 'Y'; // Normalde çalıştığı günse 'Y' ata
                                        hours = calismaSaati;
                                    } else {
                                        code = 'E'; // Normalde çalışmadığı günse 'E' ata
                                        hours = 0;
                                    }
                                }
                            } else {
                                if (isResmiTatil(dateUTC)) {
                                    code = 'RT';
                                } else {
                                    let isWeekend = (anlikSozlesmeTuru === 'Belirli Süreli') ? (dateUTC.getDay() === 6 || dateUTC.getDay() === 0) : (dateUTC.getDay() === 0);
                                    if (isWeekend) {
                                        code = 'HT';
                                    } else {
                                        code = 'N';
                                        const gecerliProgramVersiyonu = personelScheduleData[personel.id]?.find(v => v.tarih <= dateString);
                                        const gununDersSaati = gecerliProgramVersiyonu?.gunlukSaatler?.[gunlerTR[dateUTC.getDay()]] || 0;

                                        if (personel.unvan && (personel.unvan.toLowerCase().includes('müdür') || personel.unvan.includes('Rehber Öğretmen') || personel.unvan.includes('Rehberlik'))) {
                                            hours = 4;
                                        } else if (anlikSozlesmeTuru === 'Belirsiz Süreli') {
                                            hours = 7.5;
                                        } else if (anlikSozlesmeTuru === 'Belirli Süreli' && isEgitimPersoneli && gununDersSaati === 0) {
                                            hours = 0;
                                        } else {
                                            hours = gununDersSaati;
                                        }
                                    }
                                }
                            }

                            // --- PUANTAJ DETAYLANDIRMA ---
                            let baseHours = hours; // İzin kontrolünden önceki 'temel' saati sakla
                            let gorevlendirmeHours = 0;
                            let notes = '';

                            const leaveCodeForDay = izinVerisi[personel.id]?.[dateString];
                            if (leaveCodeForDay) {
                                // İzinliyse, temel saatini sıfırla
                                if (leaveCodeForDay === 'R' && ['N', 'Y', 'HT'].includes(code)) {
                                    code = leaveCodeForDay;
                                    baseHours = 0; 
                                }
                                else if (leaveCodeForDay !== 'R' && ['N', 'Y'].includes(code)) {
                                    code = leaveCodeForDay;
                                    baseHours = 0; 
                                }
                            }

                            // --- GÖREVLENDİRME KONTROLÜ ---
                            if (!leaveCodeForDay) { // Personel izinli değilse görevlendirme kontrolü yap
                                
                                // 1. Asıl öğretmenin saatini DÜŞÜR
                                const asilGorevSaatSayisi = asilOgretmenGorevMap.get(dateString)?.get(personel.id) || 0;
                                if (asilGorevSaatSayisi > 0 && isEgitimPersoneli) {
                                    baseHours = Math.max(0, baseHours - asilGorevSaatSayisi);
                                    notes += `Görevlendirme nedeniyle ${asilGorevSaatSayisi} saat düşüldü.`;
                                }

                                // 2. Görevli öğretmenin saatini ARTIR
                                const gorevliEkSaatSayisi = gorevliOgretmenGorevMap.get(dateString)?.get(personel.id) || 0;
                                if (gorevliEkSaatSayisi > 0 && isEgitimPersoneli) {
                                    gorevlendirmeHours = gorevliEkSaatSayisi;
                                    notes += `Görevlendirme nedeniyle ${gorevliEkSaatSayisi} saat eklendi.`;
                                    if (code === 'HT' || code === 'E') {
                                        code = 'N'; // Görevlendirme olduğu için normal çalışma gününe çevir
                                    }
                                }
                            }
                            // --- KONTROL SONU ---
                            
                            const finalHours = baseHours + gorevlendirmeHours;

                            // Veriyi detaylı olarak kaydet
                            puantajData[uniquePeriodId]['dailyData'][dateString] = { 
                                code: code, 
                                hours: finalHours, 
                                baseHours: baseHours, 
                                gorevlendirmeHours: gorevlendirmeHours,
                                notes: notes.trim()
                            };
                        }
                    });

                    const calculatedHoursMap = new Map();
                    const hourCalculationPromises = aktifPersonelList.map(async (personel) => {
                        const hours = await calculateMonthlyHours(personel.uniquePeriodId);
                        calculatedHoursMap.set(personel.uniquePeriodId, hours);
                    });
                    await Promise.all(hourCalculationPromises);

                    await renderPuantajTable(nobetVerisi, aktifPersonelList, baslikMetni, calculatedHoursMap);
                    await renderGrandTotals(nobetVerisi, aktifPersonelList, calculatedHoursMap);
                    renderLegend();
                    attachCellListeners();
                    showToast('Puantaj başarıyla oluşturuldu!', 'success');
                } catch (error) {
                    console.error("Puantaj oluşturulurken hata:", error);
                    showToast('Puantaj oluşturulamadı.', 'error');
                } finally {
                    hideSpinner();
                }
            }

            async function getPersonelPeriodsForMonth(year, month) {
                const ayinIlkGunu = new Date(Date.UTC(year, month, 1));
                const ayinSonGunu = new Date(Date.UTC(year, month + 1, 0));
                const ayIlkGunStr = ayinIlkGunu.toISOString().split('T')[0];
                const aySonGunStr = ayinSonGunu.toISOString().split('T')[0];

                const personelPeriods = [];

                const personelSnap = await getDocs(query(collection(db, "personel"), where("okulId", "==", currentUserOkulId)));

                const [gorevSnap, neviSnap] = await Promise.all([
                    getSettings('ayarlar_gorevler'),
                    getSettings('ayarlar_personel_nevileri')
                ]);
                const gorevMap = new Map(gorevSnap.docs.map(doc => [doc.id, doc.data().name]));
                const neviMap = new Map(neviSnap.docs.map(doc => [doc.id, doc.data().name]));

                for (const personelDoc of personelSnap.docs) {
                    const personelData = { id: personelDoc.id, ...personelDoc.data() };

                    const hizmetGecmisiRef = collection(db, 'personel', personelDoc.id, 'hizmetGecmisi');
                    const hizmetSnap = await getDocs(hizmetGecmisiRef);

                    if (!hizmetSnap.empty) {
                        hizmetSnap.forEach(hizmetDoc => {
                            const hizmet = hizmetDoc.data();
                            const baslangicTarihi = hizmet.baslangicTarihi;
                            const bitisTarihi = hizmet.bitisTarihi;

                            const isRelevant =
                                (baslangicTarihi <= aySonGunStr) &&
                                (bitisTarihi === null || bitisTarihi >= ayIlkGunStr);

                            if (isRelevant) {
                                const effectiveStartDate = (baslangicTarihi < ayIlkGunStr) ? ayIlkGunStr : baslangicTarihi;
                                const effectiveEndDate = (bitisTarihi === null || bitisTarihi > aySonGunStr) ? aySonGunStr : bitisTarihi;

                                personelPeriods.push({
                                    ...personelData,
                                    gorevi_bransi: hizmet.gorevId,
                                    sozlesme_turu: hizmet.sozlesmeTuru,
                                    unvan: gorevMap.get(hizmet.gorevId) || 'Bilinmiyor',
                                    neviAdi: neviMap.get(personelData.personel_nevisi) || 'Bilinmiyor',
                                    effectiveStartDate: effectiveStartDate,
                                    effectiveEndDate: effectiveEndDate,
                                    uniquePeriodId: `${personelData.id}_${hizmet.baslangicTarihi}`
                                });
                            }
                        });
                    } else {
                        const baslangicTarihi = personelData.ise_giris;
                        const bitisTarihi = personelData.isten_ayrilis || null;

                        if (!baslangicTarihi) continue; // İşe giriş tarihi yoksa personeli atla

                        const isRelevant =
                            (baslangicTarihi <= aySonGunStr) &&
                            (bitisTarihi === null || bitisTarihi === '---' || bitisTarihi === '' || bitisTarihi >= ayIlkGunStr);

                        if (isRelevant) {
                            const effectiveStartDate = (baslangicTarihi < ayIlkGunStr) ? ayIlkGunStr : baslangicTarihi;
                            let effectiveEndDate = aySonGunStr;
                            if (bitisTarihi && bitisTarihi !== '---' && bitisTarihi !== '' && bitisTarihi < aySonGunStr) {
                                effectiveEndDate = bitisTarihi;
                            }

                            personelPeriods.push({
                                ...personelData,
                                unvan: gorevMap.get(personelData.gorevi_bransi) || 'Bilinmiyor',
                                neviAdi: neviMap.get(personelData.personel_nevisi) || 'Bilinmiyor',
                                effectiveStartDate: effectiveStartDate,
                                effectiveEndDate: effectiveEndDate,
                                uniquePeriodId: `${personelData.id}_${personelData.ise_giris}`
                            });
                        }
                    }
                }

                return personelPeriods;
            }






            async function generateIndividualPuantaj() {
                const selectedPersonelId = document.getElementById('personel-filter-select').value;
                if (!selectedPersonelId || selectedPersonelId === 'all') {
                    showToast('Lütfen önce listeden bir personel seçin.', 'error');
                    return;
                }
                const personel = puantajPersonelList.find(p => p.id === selectedPersonelId);
                if (!personel) {
                    showToast('Seçilen personel verisi bulunamadı.', 'error');
                    return;
                }
                if (!confirm(`'${personel.ad}' için puantaj yeniden hazırlanacak. Bu personelin mevcut puantaj verileri sıfırlanacaktır. Devam etmek istiyor musunuz?`)) {
                    return;
                }
                try {
                    const year = parseInt(document.getElementById('input-year').value);
                    const month = parseInt(document.getElementById('select-month').value);
                    showToast(`'${personel.ad}' için puantaj hazırlanıyor...`);
                    const [scheduleData, izinVerisi] = await Promise.all([
                        fetchAndProcessSchedules(),
                        fetchIzinDataForPuantaj(year, month)
                    ]);
                    const gunlerTR = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
                    const individualPuantajData = {
                        ad: personel.ad,
                        unvan: personel.unvan,
                        neviAdi: personel.neviAdi,
                        sozlesmeTuru: personel.sozlesme_turu,
                        maasKarsiligi: personel.maasKarsiligi,
                        rehberlik_gorevi: personel.rehberlik_gorevi,
                        esDurumu: personel.esDurumu,
                        cocuk0_6: personel.cocuk0_6,
                        cocuk6_18: personel.cocuk6_18,
                        ise_giris: personel.ise_giris,
                        isten_ayrilis: personel.isten_ayrilis,
                        kismi_zamanli_calisma: personel.kismi_zamanli_calisma,
                        dailyData: {}
                    };
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    for (let day = 1; day <= daysInMonth; day++) {
                        const dateUTC = new Date(Date.UTC(year, month, day));
                        const dateString = dateUTC.toISOString().split('T')[0];
                        let code = '', hours = 0;

                        if (personel.isten_ayrilis && personel.isten_ayrilis !== '---') {
                            const ayrilisTarihiUTC = new Date(personel.isten_ayrilis + 'T00:00:00Z');
                            if (dateUTC > ayrilisTarihiUTC) {
                                individualPuantajData.dailyData[dateString] = { code: '', hours: 0, notes: '' };
                                continue;
                            }
                        }

                        const dayOfWeek = dateUTC.getDay();
                        const dayOfWeekTR = gunlerTR[dayOfWeek];

                        if (personel.sozlesme_turu === 'Kısmi Süreli') {
                            if (isResmiTatil(dateUTC)) {
                                code = 'E';
                            } else {
                                const scheduledHours = parseInt(personel.kismi_zamanli_calisma?.[dayOfWeekTR] || scheduleData[personel.id]?.[dayOfWeekTR] || 0);
                                code = (scheduledHours > 0) ? 'Y' : 'E';
                                hours = scheduledHours;
                            }
                        } else {
                            if (isResmiTatil(dateUTC)) {
                                code = 'RT';
                            } else {
                                let isWeekend = (personel.sozlesme_turu === 'Belirli Süreli') ? (dayOfWeek === 6 || dayOfWeek === 0) : (dayOfWeek === 0);
                                if (isWeekend) {
                                    code = 'HT';
                                } else {
                                    code = 'N';
                                    if (personel.unvan && (personel.unvan.includes('Okul Müdürü') || personel.unvan.includes('Rehber Öğretmen') || personel.unvan.includes('Rehberlik'))) {
                                        hours = 4;
                                    } else {
                                        hours = (personel.sozlesme_turu === 'Belirsiz Süreli') ? 7.5 : (scheduleData[personel.id]?.[dayOfWeekTR] || 0);
                                    }
                                }
                            }
                        }
                        const leaveCodeForDay = izinVerisi[personel.id]?.[dateString];
                        if (leaveCodeForDay) {
                            if (leaveCodeForDay === 'R' && ['N', 'Y', 'HT'].includes(code)) {
                                code = leaveCodeForDay;
                                hours = 0;
                            } else if (leaveCodeForDay !== 'R' && ['N', 'Y'].includes(code)) {
                                code = leaveCodeForDay;
                                hours = 0;
                            }
                        }

                        individualPuantajData.dailyData[dateString] = { code, hours, notes: '' };
                    }
                    puantajData[selectedPersonelId] = individualPuantajData;
                    showToast('Bireysel puantaj hazırlandı. Veritabanına kaydediliyor...', 'info');
                    await savePuantajData();
                    await loadPuantajDataForCurrentMonth();
                } catch (error) {
                    console.error("Bireysel puantaj oluşturulurken hata:", error);
                    showToast('Bireysel puantaj oluşturulamadı.', 'error');
                }
            }



            function printPuantaj() {
                window.print();
            }

            function downloadPdf() {
                const year = document.getElementById('input-year').value;
                const monthName = document.getElementById('select-month').options[document.getElementById('select-month').selectedIndex].text;


                const puantajTablosu = document.querySelector('#puantaj-table-container .puantaj-table');

                if (!puantajTablosu) {
                    return showToast('PDF\'e aktarılacak puantaj tablosu bulunmuyor.', 'error');
                }

                showToast('PDF oluşturuluyor, bu işlem biraz sürebilir...', 'info');

                html2canvas(puantajTablosu, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff'
                }).then(canvas => {
                    const imgData = canvas.toDataURL('image/png');
                    const { jsPDF } = window.jspdf;


                    const canvasWidth = canvas.width;
                    const canvasHeight = canvas.height;





                    const pdf = new jsPDF({
                        orientation: 'l',
                        unit: 'pt',
                        format: [canvasWidth + 60, canvasHeight + 60]
                    });


                    pdf.addImage(imgData, 'PNG', 30, 30, canvasWidth, canvasHeight);

                    pdf.save(`Puantaj_${monthName}_${year}.pdf`);
                    showToast('PDF başarıyla indirildi.', 'success');
                }).catch(err => {
                    console.error("PDF oluşturulurken html2canvas hatası:", err);
                    showToast('PDF oluşturulurken bir hata oluştu.', 'error');
                });
            }


            async function downloadExcel() {
                try {
                    showToast('Excel dosyası hazırlanıyor, lütfen bekleyin...', 'info');
                    const statusColors = {
                        'N': '#E8F5E9', 'HT': '#FFEBCC', 'RT': '#D1EAFE', 'İ': '#E6EAFE',
                        'R': '#FFEBEE', 'Üİ': '#EAECEE', 'S': '#FFF9C4', 'K': '#D7F9E9',
                        'Y': '#D7F9E9', 'E': '#EEEEEE', 'RTÇ': '#E1BEE7'
                    };
                    const summaryColors = {
                        aylikToplam: '#FFECB3', ekDers: '#C8E6C9', nobet: '#FFE0B2',
                        rehberlik: '#C5CAE9', fazlaMesai: '#FFCDD2', mesaiNedeni: '#D2B4DE',
                        eksikGunKodu: '#AED6F1', gunToplam: '#E3F2FD', sgkPrim: '#E3F2FD',
                        sosyal: '#FFFFFF'
                    };
                    const headerStyle = 'background-color:#343a40; color:white; font-weight:bold; text-align:center; vertical-align:middle; border:0.5pt solid #888888;';
                    const cellStyle = (bgColor = '#FFFFFF') => `background-color:${bgColor}; text-align:center; vertical-align:middle; border:0.5pt solid #888888;`;
                    const year = document.getElementById('input-year').value;
                    const month = parseInt(document.getElementById('select-month').value);
                    const monthName = document.getElementById('select-month').options[month].text;
                    const educationPeriods = await fetchEducationPeriods(); // Rehberlik hesaplaması için gerekli
                    const aktifPersonelList = await getPersonelPeriodsForMonth(year, month);

                    let personelToExport = aktifPersonelList;
                    const selectedPersonelId = document.getElementById('personel-filter-select').value;
                    if (selectedPersonelId && selectedPersonelId !== 'all') {
                        personelToExport = aktifPersonelList.filter(p => p.id === selectedPersonelId);
                    }

                    if (personelToExport.length === 0) {
                        return showToast('Dışa aktarılacak personel bulunmuyor.', 'error');
                    }

                    const okulAdi = await getCurrentSchoolName();
                    const anaBaslik = `${okulAdi.toLocaleUpperCase('tr-TR')} ${year} YILI ${monthName.toLocaleUpperCase('tr-TR')} AYI PERSONEL PUANTAJ CETVELİ`;
                    const nobetVerisi = await fetchAndCalculateNobetData(year, month);

                    let excelHtml = `<table width="100%"><tr style="height:40px;"><td colspan="50" style="text-align:center; font-size:16pt; font-weight:bold;">${anaBaslik}</td></tr></table><br/>`;
                    const gunler = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
                    const gunBasliklari = ["N", "HT", "RT", "İ", "R", "Üİ", "S", "K", "RTÇ"];
                    const daysInMonth = new Date(year, month + 1, 0).getDate();

                    const grupluPersonel = {
                        'Belirli Süreli': personelToExport.filter(p => p.sozlesme_turu === 'Belirli Süreli'),
                        'Belirsiz Süreli': personelToExport.filter(p => p.sozlesme_turu === 'Belirsiz Süreli'),
                        'Kısmi Süreli': personelToExport.filter(p => p.sozlesme_turu === 'Kısmi Süreli')
                    };
                    const grupSiralama = ['Belirli Süreli', 'Belirsiz Süreli', 'Kısmi Süreli'];

                    const saatBasliklariConfig = {
                        'Belirsiz Süreli': { headers: ["Aylık\nToplam", "Fazla\nMesai", "Mesai\nNedeni", "E. G.\nKodu"] },
                        'Belirli Süreli': { headers: ["Aylık\nToplam", "Ek\nDers", "Nöbet", "Rehberlik"] },
                        'Kısmi Süreli': { headers: ["Aylık\nToplam", "Ek\nDers", "Nöbet", "Rehberlik"] }
                    };

                    excelHtml += '<table style="border-collapse:collapse;">';

                    for (const grupAdi of grupSiralama) {
                        const personelGrubu = grupluPersonel[grupAdi];
                        if (!personelGrubu || personelGrubu.length === 0) continue;

                        personelGrubu.sort((a, b) => a.ad_soyad.localeCompare(b.ad_soyad, 'tr'));

                        const saatConfig = saatBasliklariConfig[grupAdi];
                        const colspan = 3 + daysInMonth + saatConfig.headers.length + gunBasliklari.length + 4;
                        excelHtml += `<tr><td colspan="${colspan}" style="${headerStyle} text-align:left; padding-left:10px; font-size:13pt;">${grupAdi} Puantaj Kayıtları</td></tr>`;
                        excelHtml += `<thead><tr><th rowspan="2" style="${headerStyle}">Personel</th><th rowspan="2" style="${headerStyle}">Unvan</th><th rowspan="2" style="${headerStyle}">İşe Giriş<br>İşten Çıkış</th><th colspan="${daysInMonth}" style="${headerStyle}">Aylık Puantaj Durumu</th><th colspan="${saatConfig.headers.length}" style="${headerStyle}">Aylık Saat Toplamları</th><th colspan="${gunBasliklari.length}" style="${headerStyle}">Aylık Gün Toplamları</th><th rowspan="2" style="${headerStyle}">Sgk&nbsp;Prim&nbsp;Günü</th><th colspan="3" style="${headerStyle}">Sosyal Yardımlar</th><th rowspan="2" style="${headerStyle}">İmza</th></tr><tr>`;
                        for (let day = 1; day <= daysInMonth; day++) {
                            const date = new Date(year, month, day);
                            excelHtml += `<th style="${headerStyle}">${day}<br>${gunler[date.getDay()]}</th>`;
                        }
                        saatConfig.headers.forEach(h => excelHtml += `<th style="${headerStyle}">${h.replace('\n', '<br>')}</th>`);
                        gunBasliklari.forEach(h => excelHtml += `<th style="${headerStyle}">${h}</th>`);
                        excelHtml += `<th style="${headerStyle}">Eş Durumu</th><th style="${headerStyle}">Çocuk 0-6</th><th style="${headerStyle}">Çocuk 6-18</th></tr></thead><tbody>`;

                        for (const personel of personelGrubu) {
                            const pData = puantajData[personel.uniquePeriodId] || { dailyData: {} };
                            const monthlyHours = await calculateMonthlyHours(personel.uniquePeriodId);
                            const nobetSaat = nobetVerisi[personel.id] || 0;
                            const rehberlikSaat = calculateEffectiveRehberlikHours(personel.uniquePeriodId, year, month, puantajData, educationPeriods);
                            const fazlaMesaiSaat = calculateFazlaMesai(personel.uniquePeriodId);
                            const statusCounts = calculateStatusCounts(personel.uniquePeriodId);

                            const periodStartDate = new Date(personel.effectiveStartDate + 'T00:00:00Z');
                            const periodEndDate = new Date(personel.effectiveEndDate + 'T00:00:00Z');
                            const gunFarki = (periodEndDate - periodStartDate) / (1000 * 60 * 60 * 24) + 1;
                            let sgkPrimGunu = gunFarki - ((statusCounts.R || 0) + (statusCounts.Üİ || 0));
                            if (personel.sozlesme_turu === 'Kısmi Süreli') { sgkPrimGunu = Math.round(monthlyHours.genelToplam / 7.5); }

                            let ayrilisTarihiGoster = personel.isten_ayrilis && personel.isten_ayrilis !== '---' ? formatDateDDMMYYYY(personel.isten_ayrilis) : '---';

                            let esDurumuText = '---';
                            if (personel.es_durumu === 'çalışmıyor') esDurumuText = 'Çalışmıyor';
                            else if (personel.es_durumu === 'çalışıyor') esDurumuText = 'Çalışıyor';
                            else if (personel.es_durumu === 'bekar') esDurumuText = 'Bekar';

                            let statusRowHtml = `<tr><td rowspan="2" style="${cellStyle()} text-align:left; padding-left:5px;">${personel.ad_soyad || ''}</td><td rowspan="2" style="${cellStyle()} text-align:left; padding-left:5px;">${personel.unvan || ''}</td><td rowspan="2" style="${cellStyle()}">${formatDateDDMMYYYY(personel.ise_giris)}<br>${ayrilisTarihiGoster}</td>`;
                            let hoursRowHtml = `<tr>`;

                            for (let day = 1; day <= daysInMonth; day++) {
                                const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                const dayData = pData.dailyData[dateString] || {};
                                const bgColor = statusColors[dayData.code] || '#FFFFFF';
                                statusRowHtml += `<td style="${cellStyle(bgColor)}">${dayData.code || ''}</td>`;

                                let hourContent = (dayData.code === 'N' || dayData.code === 'RTÇ' || dayData.code === 'Y' || dayData.code === 'K') && dayData.hours > 0 ? dayData.hours : '';
                                if (hourContent === 7.5) hourContent = '&nbsp;7.5';
                                hoursRowHtml += `<td style="${cellStyle()}">${hourContent}</td>`;
                            }

                            if (grupAdi === 'Belirsiz Süreli') {
                                statusRowHtml += `<td rowspan="2" style="${cellStyle(summaryColors.aylikToplam)}">${monthlyHours.genelToplam}</td><td rowspan="2" style="${cellStyle(summaryColors.fazlaMesai)}">${fazlaMesaiSaat}</td><td rowspan="2" style="${cellStyle(summaryColors.mesaiNedeni)}">${overtimeReasons[personel.uniquePeriodId] || ''}</td><td rowspan="2" style="${cellStyle(summaryColors.eksikGunKodu)}">${missingDayCodes[personel.uniquePeriodId] || ''}</td>`;
                            } else {
                                statusRowHtml += `<td rowspan="2" style="${cellStyle(summaryColors.aylikToplam)}">${monthlyHours.genelToplam}</td><td rowspan="2" style="${cellStyle(summaryColors.ekDers)}">${monthlyHours.ekDers}</td><td rowspan="2" style="${cellStyle(summaryColors.nobet)}">${nobetSaat}</td><td rowspan="2" style="${cellStyle(summaryColors.rehberlik)}">${rehberlikSaat}</td>`;
                            }

                            gunBasliklari.forEach(h => {
                                let content = statusCounts[h] || 0;
                                if (h === 'N' && personel.sozlesme_turu === 'Kısmi Süreli') {
                                    content = sgkPrimGunu;
                                }
                                statusRowHtml += `<td rowspan="2" style="${cellStyle(summaryColors.gunToplam)}">${content}</td>`;
                            });

                            statusRowHtml += `<td rowspan="2" style="${cellStyle(summaryColors.sgkPrim)}">${sgkPrimGunu}</td><td rowspan="2" style="${cellStyle(summaryColors.sosyal)}">${esDurumuText}</td><td rowspan="2" style="${cellStyle(summaryColors.sosyal)}">${personel.cocuk_0_6 || ''}</td><td rowspan="2" style="${cellStyle(summaryColors.sosyal)}">${personel.cocuk_6_ustu || ''}</td><td rowspan="2" style="${cellStyle()}"></td></tr>`;
                            hoursRowHtml += `</tr>`;
                            excelHtml += statusRowHtml + hoursRowHtml;
                        }
                        excelHtml += `</tbody>`;
                    }
                    excelHtml += '</table>';

                    const statusDescriptions = {
                        'N': 'Normal', 'HT': 'Hafta Sonu', 'RT': 'Resmi Tatil', 'İ': 'İzinli (Ücretli)',
                        'R': 'Raporlu', 'Üİ': 'Ücretsiz İzin', 'S': 'Yıllık İzin', 'K': 'Yarım Gün Çalışma',
                        'Y': 'Yarım Gün Çalışma (Kısmi)', 'E': 'Eksik Gün', 'RTÇ': 'Resmi Tatil Çalışması'
                    };

                    excelHtml += '<br><br><table style="border-collapse:collapse;">'; // "Lejant" başlığı kaldırıldı
                    for (const code in statusDescriptions) {
                        if (statusColors[code]) {
                            excelHtml += `<tr><td style="${cellStyle(statusColors[code])}">${code}</td><td style="${cellStyle()} padding:4px 8px; text-align:left;">${statusDescriptions[code]}</td></tr>`;
                        }
                    }
                    excelHtml += '</table>';

                    const fullHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"></head><body>${excelHtml}</body></html>`;

                    const blob = new Blob(['\uFEFF', fullHtml], { type: 'application/vnd.ms-excel' });

                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Puantaj_${monthName}_${year}.xls`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    showToast('Excel dosyası başarıyla indirildi.', 'success');
                } catch (error) {
                    console.error("Excel oluşturulurken hata:", error);
                    showToast('Excel dosyası oluşturulurken bir hata oluştu.', 'error');
                }
            }
            async function getCurrentSchoolName() {
                if (!currentUserOkulId) return "OKUL ADI BULUNAMADI";
                try {
                    const okulDoc = await getDoc(doc(db, "okullar", currentUserOkulId));
                    return okulDoc.exists() ? okulDoc.data().adi : "BİLİNMEYEN OKUL";
                } catch (error) {
                    console.error("Okul adı çekilirken hata:", error);
                    return "OKUL ADI HATASI";
                }
            }
            async function fetchAndCalculateNobetData(year, month) {
                const startDateString = `${year}-${String(month + 1).padStart(2, '0')}-01`;
                const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
                const endDateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
                const q = query(
                    collection(db, 'nobetler'),
                    where("okulId", "==", currentUserOkulId),
                    where('tarih', '>=', startDateString),
                    where('tarih', '<=', endDateString) // Operatör '<' yerine '<=' olarak değiştirildi.
                );

                const nobetSnap = await getDocs(q);
                const nobetHaftalari = {};

                const getWeekNumber = (d) => {
                    const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
                    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
                    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
                    const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
                    return weekNo;
                };

                nobetSnap.forEach(doc => {
                    const nobet = doc.data();
                    const tarih = new Date(nobet.tarih + 'T00:00:00Z'); // Tarihi her zaman UTC olarak işle
                    const haftaNo = getWeekNumber(tarih);
                    if (!nobetHaftalari[nobet.personelId]) {
                        nobetHaftalari[nobet.personelId] = new Set();
                    }
                    nobetHaftalari[nobet.personelId].add(haftaNo);
                });

                const nobetEkDers = {};
                for (const personelId in nobetHaftalari) {
                    nobetEkDers[personelId] = nobetHaftalari[personelId].size * 3;
                }
                return nobetEkDers;
            }
            async function calculateMonthlyHours(uniquePeriodId) {
                const personelPuantajVerisi = puantajData[uniquePeriodId];
                if (!personelPuantajVerisi || !personelPuantajVerisi.dailyData) {
                    return {
                        genelToplam: 0, ekDers: 0, normalDersSaati: 0,
                        gorevlendirmeDersSaati: 0, seminerEkDers: 0, yoneticilikEkDers: 0
                    };
                }

                const unvan = personelPuantajVerisi.unvan || '';
                const maasKarsiligi = parseInt(personelPuantajVerisi.maas_karsiligi) || 0;
                const sozlesmeTuru = personelPuantajVerisi.sozlesme_turu || '';
                const neviAdi = personelPuantajVerisi.neviAdi || '';
                const dailyData = personelPuantajVerisi.dailyData;

                let totalBaseHours = 0;
                let totalGorevlendirmeHours = 0;
                let yoneticilikEkDers = 0;
                let seminerEkDers = 0;
                let ekDers = 0;

                const isEgitimPersoneli = neviAdi.includes('Eğitim Personeli');

                if (unvan.includes('Okul Müdürü') || unvan.includes('Rehber Öğretmen') || unvan.includes('Rehberlik') || unvan.toLowerCase().includes('müdür')) {
                    Object.values(dailyData || {}).forEach(dayData => {
                        if (['N', 'RTÇ', 'Y', 'K'].includes(dayData.code)) {
                            totalBaseHours += (dayData.baseHours || 0);
                            totalGorevlendirmeHours += (dayData.gorevlendirmeHours || 0);
                        }
                    });
                    if (!unvan.toLowerCase().includes('anaokulu müdürü')) {
                        Object.keys(dailyData || {}).forEach(dateString => {
                            if (['N', 'RTÇ'].includes(dailyData[dateString].code)) {
                                yoneticilikEkDers += 4;
                            }
                        });
                    }
                }
                else if (unvan.includes('Müdür Yardımcısı')) {
                    const yardimciSchedule = [0, 4, 4, 4, 3, 3, 0]; 
                    Object.keys(dailyData).forEach(dateString => {
                        if (['N', 'RTÇ'].includes(dailyData[dateString].code)) {
                            const date = new Date(dateString + 'T00:00:00');
                            yoneticilikEkDers += yardimciSchedule[date.getDay()];
                        }
                    });
                }
                else if (sozlesmeTuru === 'Belirli Süreli' && isEgitimPersoneli) {
                    const seminarPeriods = await fetchSeminarPeriods();
                    const weeklyData = {};

                    const getWeek = (d) => {
                        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
                        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
                        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
                        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
                    };

                    for (const dateString in dailyData) {
                        const dayData = dailyData[dateString];
                        if (!dayData.code || dayData.hours === 0) continue;

                        const dateUTC = new Date(dateString + 'T00:00:00Z');
                        const isSeminarDay = seminarPeriods.some(p => dateUTC >= p.baslangic && dateUTC <= p.bitis);

                        if (isSeminarDay && ['N', 'RTÇ', 'Y', 'K'].includes(dayData.code)) {
                            seminerEkDers += 4; 
                        } else if (['N', 'RTÇ', 'Y', 'K'].includes(dayData.code)) {
                            const weekNumber = getWeek(dateUTC);
                            if (!weeklyData[weekNumber]) {
                                weeklyData[weekNumber] = { baseHours: 0, gorevlendirmeHours: 0, workdaysInMonth: 0 };
                            }
                            weeklyData[weekNumber].baseHours += (dayData.baseHours || 0);
                            weeklyData[weekNumber].gorevlendirmeHours += (dayData.gorevlendirmeHours || 0);
                            weeklyData[weekNumber].workdaysInMonth++;
                        }
                    }

                    let normalGunlerdenEkDers = 0;
                    for (const week in weeklyData) {
                        const weekInfo = weeklyData[week];
                        const haftalikToplamSaat = weekInfo.baseHours + weekInfo.gorevlendirmeHours;
                        totalBaseHours += weekInfo.baseHours;
                        totalGorevlendirmeHours += weekInfo.gorevlendirmeHours;

                        const proportionalDeduction = (maasKarsiligi / 5) * weekInfo.workdaysInMonth;
                        const ekDersForWeek = haftalikToplamSaat - proportionalDeduction;

                        if (ekDersForWeek > 0) {
                            normalGunlerdenEkDers += ekDersForWeek;
                        }
                    }
                    ekDers = normalGunlerdenEkDers + seminerEkDers + yoneticilikEkDers;

                } else {
                    Object.values(dailyData || {}).forEach(dayData => {
                        if (['N', 'RTÇ', 'Y', 'K'].includes(dayData.code)) {
                            totalBaseHours += (dayData.baseHours || 0);
                            totalGorevlendirmeHours += (dayData.gorevlendirmeHours || 0);
                        }
                    });
                }

                const genelToplam = Math.round((totalBaseHours + totalGorevlendirmeHours) * 10) / 10;
                
                if (sozlesmeTuru === 'Belirli Süreli' && isEgitimPersoneli) {
                    // Ek ders zaten hesaplandı
                } else {
                    ekDers = yoneticilikEkDers; 
                }

                return {
                    genelToplam: genelToplam,
                    ekDers: Math.round(ekDers),
                    normalDersSaati: Math.round(totalBaseHours * 10) / 10,
                    gorevlendirmeDersSaati: Math.round(totalGorevlendirmeHours * 10) / 10,
                    seminerEkDers: Math.round(seminerEkDers),
                    yoneticilikEkDers: Math.round(yoneticilikEkDers)
                };
            }


            async function renderPuantajTable(nobetVerisi, aktifPersonelListesi, baslikMetni, calculatedHoursMap) {
                const container = document.getElementById('puantaj-table-container');
                const year = parseInt(document.getElementById('input-year').value);
                const month = parseInt(document.getElementById('select-month').value);

                const educationPeriods = await fetchEducationPeriods();

                let finalHTML = `<h2 id="puantaj-baslik" style="text-align: center; color: var(--theme-primary); margin-bottom: 25px;">${baslikMetni}</h2>`;

                if (!aktifPersonelListesi || aktifPersonelListesi.length === 0 || !puantajData) {
                    container.innerHTML = `<div style="padding: 40px; text-align: center; background-color: #f8f9fa; border-radius: 8px;"><h4 style="color: var(--theme-primary);">Bu ay için görüntülenecek puantaj verisi veya aktif personel bulunmuyor.</h4></div>`;
                    return;
                }

                const personelPuantajData = {};
                aktifPersonelListesi.forEach(period => {
                    const uniqueId = period.uniquePeriodId;
                    if (puantajData[uniqueId]) {
                        personelPuantajData[uniqueId] = { ...period, ...puantajData[uniqueId] };
                    }
                });

                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const gunler = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
                const grupSiralama = ['Belirli Süreli', 'Belirsiz Süreli', 'Kısmi Süreli'];

                const grupluPersonel = {
                    'Belirsiz Süreli': Object.values(personelPuantajData).filter(p => p.sozlesme_turu === 'Belirsiz Süreli').sort((a, b) => a.ad_soyad.localeCompare(b.ad_soyad, 'tr')),
                    'Belirli Süreli': Object.values(personelPuantajData).filter(p => p.sozlesme_turu === 'Belirli Süreli').sort((a, b) => a.ad_soyad.localeCompare(b.ad_soyad, 'tr')),
                    'Kısmi Süreli': Object.values(personelPuantajData).filter(p => p.sozlesme_turu === 'Kısmi Süreli').sort((a, b) => a.ad_soyad.localeCompare(b.ad_soyad, 'tr'))
                };

                grupSiralama.forEach(grupAdi => {
                    const personelGrubu = grupluPersonel[grupAdi];
                    if (personelGrubu.length === 0) return;

                    const ayAdi = document.getElementById('select-month').options[month].text;
                    const yeniGrupBasligi = `${ayAdi} ${year} Ayı Personel Puantaj Kayıtları ( ${grupAdi.toLocaleUpperCase('tr-TR')} )`;
                    finalHTML += `<h3 style="margin-top: 30px; padding: 10px; background-color: #343a40; color: white; border-radius: 5px;">${yeniGrupBasligi}</h3>`;
                    let tableHTML = `<table class="puantaj-table"><thead><tr><th rowspan="2">Personel</th><th rowspan="2">Unvan</th><th rowspan="2" class="vertical-divider">İşe Giriş<br>İşten Çıkış</th><th colspan="${daysInMonth}">Aylık Puantaj Durumu</th><th colspan="${(grupAdi === 'Belirsiz Süreli') ? 4 : 4}" class="vertical-divider">Aylık Saat Toplamları</th><th colspan="9" class="vertical-divider">Aylık Gün Toplamları</th><th rowspan="2" class="vertical-divider">Sgk Prim Günü</th><th colspan="3">Sosyal Yardımlar</th><th rowspan="2">İmza</th></tr><tr>`;
                    for (let day = 1; day <= daysInMonth; day++) {
                        const date = new Date(year, month, day);
                        const dividerClass = (new Date(year, month, day).getDay() === 0 || day === daysInMonth) ? 'vertical-divider' : '';
                        tableHTML += `<th class="col-day ${dividerClass}">${day}<br>${gunler[date.getDay()]}</th>`;
                    }
                    tableHTML += `<th>Aylık Toplam</th>${(grupAdi === 'Belirsiz Süreli') ? '<th>Fazla Mesai</th><th>Mesai Nedeni</th><th>E. G.<br>Kodu</th>' : `<th>Ek Ders</th><th>Nöbet</th><th class="vertical-divider">Rehberlik</th>`}<th>N</th><th>HT</th><th>RT</th><th>İ</th><th>R</th><th>Üİ</th><th>S</th><th>K</th><th class="vertical-divider">RTÇ</th><th>Eş Durumu</th><th>Çocuk 0-6</th><th>Çocuk 6-18</th></tr></thead><tbody>`;

                    personelGrubu.forEach(personel => {
                        const uniquePeriodId = personel.uniquePeriodId;
                        if (!personel.dailyData) { return; }

                        let ayrilisTarihiGoster = '---';
                        if (personel.isten_ayrilis && personel.isten_ayrilis !== '---') {
                            const ayrilisDate = new Date(personel.isten_ayrilis + 'T00:00:00Z');
                            if (ayrilisDate.getUTCFullYear() === year && ayrilisDate.getUTCMonth() === month) {
                                ayrilisTarihiGoster = formatDateDDMMYYYY(personel.isten_ayrilis);
                            }
                        }

                        const pData = puantajData[uniquePeriodId] || { dailyData: {} };
                        const monthlyHours = calculatedHoursMap.get(uniquePeriodId) || { genelToplam: 0, ekDers: 0 };
                        const nobetSaat = nobetVerisi[personel.id] || 0;
                        const rehberlikSaat = calculateEffectiveRehberlikHours(uniquePeriodId, year, month, puantajData, educationPeriods);
                        const statusCounts = calculateStatusCounts(uniquePeriodId);

                        let sgkPrimGunu = 0;
                        const periodStartDate = new Date(personel.effectiveStartDate + 'T00:00:00Z');
                        const periodEndDate = new Date(personel.effectiveEndDate + 'T00:00:00Z');
                        const gunFarki = (periodEndDate - periodStartDate) / (1000 * 60 * 60 * 24) + 1;
                        sgkPrimGunu = gunFarki - ((statusCounts.R || 0) + (statusCounts.Üİ || 0));

                        if (personel.sozlesme_turu === 'Kısmi Süreli') {
                            sgkPrimGunu = Math.round(monthlyHours.genelToplam / 7.5);
                        }

                        let esDurumuText = '---';
                        if (personel.es_durumu === 'çalışmıyor') esDurumuText = 'Çalışmıyor';
                        else if (personel.es_durumu === 'çalışıyor') esDurumuText = 'Çalışıyor';
                        else if (personel.es_durumu === 'bekar') esDurumuText = 'Bekar';

                        tableHTML += `<tr class="personel-row-status"><td class="col-personel" rowspan="2">${personel.ad_soyad}</td><td class="col-unvan" rowspan="2">${personel.unvan}</td><td class="col-date vertical-divider" rowspan="2">${formatDateDDMMYYYY(personel.ise_giris)}<br>${ayrilisTarihiGoster}</td>`;
                        for (let day = 1; day <= daysInMonth; day++) {
                            const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            const dayData = pData.dailyData[dateString] || { code: '', hours: 0 };
                            const dividerClass = (new Date(year, month, day).getDay() === 0 || day === daysInMonth) ? 'vertical-divider' : '';
                            tableHTML += `<td class="status-cell status-${dayData.code} ${dividerClass}" data-personel-id="${uniquePeriodId}" data-date="${dateString}">${dayData.code || ''}</td>`;
                        }

                        let eksikGunKoduSelect = '';
                        if (grupAdi === 'Belirsiz Süreli') {
                            let options = '<option value=""></option>';
                            eksikGunKodlari.forEach(item => {
                                const selected = (missingDayCodes[uniquePeriodId] === item.kod) ? 'selected' : '';
                                options += `<option value="${item.kod}" ${selected}>${item.kod} - ${item.aciklama}</option>`;
                            });
                            eksikGunKoduSelect = `<td rowspan="2" class="summary-missing-day"><select class="missing-day-code-select" data-personel-id="${uniquePeriodId}">${options}</select></td>`;
                        }
                        const fazlaMesaiSaat = (grupAdi === 'Belirsiz Süreli') ? calculateFazlaMesai(uniquePeriodId) : 0;
                        const mesaiNedeniInput = `<td rowspan="2" class="summary-reason"><input type="text" class="overtime-reason-input" data-personel-id="${uniquePeriodId}" value="${overtimeReasons[uniquePeriodId] || ''}"></td>`;

                        let nColumnContent = statusCounts.N || 0;
                        if (personel.sozlesme_turu === 'Kısmi Süreli') {
                            nColumnContent = sgkPrimGunu;
                        }

                        tableHTML += `<td class="summary-yellow" rowspan="2">${monthlyHours.genelToplam}</td>${(grupAdi === 'Belirsiz Süreli') ? `<td class="summary-overtime" rowspan="2">${fazlaMesaiSaat}</td>${mesaiNedeniInput}${eksikGunKoduSelect}` : `<td class="summary-green clickable-ekders" rowspan="2" 
    data-personel-id="${uniquePeriodId}" 
    data-personel-adi="${personel.ad_soyad}" 
    data-year="${year}" 
    data-month="${month}"
    data-nobet="${nobetSaat}"
    data-rehberlik="${rehberlikSaat}"
    title="Ek ders dökümünü görmek için tıklayın">${monthlyHours.ekDers}</td>
  <td class="summary-nobet" rowspan="2">${nobetSaat}</td>
  <td class="summary-rehberlik vertical-divider" rowspan="2">${rehberlikSaat}</td>`}
            <td class="col-summary-count" rowspan="2">${nColumnContent}</td>
            <td class="col-summary-count" rowspan="2">${statusCounts.HT || 0}</td><td class="col-summary-count" rowspan="2">${statusCounts.RT || 0}</td><td class="col-summary-count" rowspan="2">${statusCounts.İ || 0}</td><td class="col-summary-count" rowspan="2">${statusCounts.R || 0}</td><td class="col-summary-count" rowspan="2">${statusCounts.Üİ || 0}</td><td class="col-summary-count" rowspan="2">${statusCounts.S || 0}</td><td class="col-summary-count" rowspan="2">${statusCounts.K || 0}</td><td class="col-summary-count vertical-divider" rowspan="2">${statusCounts.RTÇ || 0}</td><td class="total-worked-day vertical-divider" rowspan="2">${sgkPrimGunu}</td>
            <td class="social-section" rowspan="2">${esDurumuText}</td>
            <td class="social-section" rowspan="2">${personel.cocuk_0_6 || ''}</td><td class="social-section" rowspan="2">${personel.cocuk_6_18 || ''}</td><td class="col-imza" rowspan="2"></td></tr>`;

                        tableHTML += `<tr class="personel-row-hours horizontal-divider">`;
                        for (let day = 1; day <= daysInMonth; day++) {
                            const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            const dayData = pData.dailyData[dateString] || { code: '', hours: 0 };
                            const dividerClass = (new Date(year, month, day).getDay() === 0 || day === daysInMonth) ? 'vertical-divider' : '';
                            const hourContent = (dayData?.code === 'N' || dayData?.code === 'RTÇ' || dayData?.code === 'Y' || dayData?.code === 'K') && dayData?.hours > 0 ? dayData.hours : '';
                            tableHTML += `<td class="hour-cell ${dividerClass}">${hourContent}</td>`;
                        }
                        tableHTML += `</tr>`;
                    });
                    tableHTML += `</tbody></table>`;
                    finalHTML += tableHTML;
                });

                container.innerHTML = finalHTML;
                attachCellListeners();
                initializeCustomSelects();
            }

            function attachCellListeners() {
                document.getElementById('puantaj-table-container').addEventListener('click', function(e) {
                    const statusCell = e.target.closest('.status-cell');
                    if (statusCell) {
                        const personelId = statusCell.dataset.personelId;
                        const date = statusCell.dataset.date;
                        openEditModal(personelId, date);
                        return; 
                    }

                    const ekDersCell = e.target.closest('.clickable-ekders');
                    if (ekDersCell) {
                        const ds = ekDersCell.dataset;
                        openEkDersDetayModal(ds.personelId, ds.personelAdi, ds.year, ds.month, ds.nobet, ds.rehberlik);
                        return;
                    }
                });
                
                const modal = document.getElementById('ekders-detay-modal');
                modal.querySelector('.close-modal').addEventListener('click', () => modal.classList.remove('open'));
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) modal.classList.remove('open');
                });
            }

            async function openEkDersDetayModal(personelId, personelAdi, year, month, nobetSaat, rehberlikSaat) {
                const modal = document.getElementById('ekders-detay-modal');
                const tbody = document.getElementById('ekders-detay-tbody');
                
                document.getElementById('ekders-personel-adi').textContent = personelAdi;
                const monthName = document.getElementById('select-month').options[month].text;
                document.getElementById('ekders-donem').textContent = `${monthName} ${year}`;
                tbody.innerHTML = '<tr><td colspan="2">Hesaplanıyor...</td></tr>';

                modal.classList.add('open');

                try {
                    const hourDetails = await calculateMonthlyHours(personelId);
                    
                    let totalEkDers = 0;
                    let html = '';

                    // 1. Normal (Maaş Karşılığı Üstü) Ek Ders
                    const normalEkDers = hourDetails.ekDers - hourDetails.yoneticilikEkDers - hourDetails.seminerEkDers;
                    if (normalEkDers > 0) {
                        html += `<tr><td>Normal Ek Ders (Maaş Karşılığı Üstü)</td><td>${normalEkDers}</td></tr>`;
                        totalEkDers += normalEkDers;
                    }

                    // 2. Görevlendirmeden Gelen Ek Ders
                    if (hourDetails.gorevlendirmeDersSaati > 0) {
                         html += `<tr><td>Görevlendirme ile Gelen Ders</td><td>${hourDetails.gorevlendirmeDersSaati}</td></tr>`;
                         totalEkDers += hourDetails.gorevlendirmeDersSaati;
                    }

                    // 3. Yöneticilik Ek Dersi
                    if (hourDetails.yoneticilikEkDers > 0) {
                        html += `<tr><td>Yöneticilik / Rehberlik Görevi</td><td>${hourDetails.yoneticilikEkDers}</td></tr>`;
                        totalEkDers += hourDetails.yoneticilikEkDers;
                    }
                    
                    // 4. Seminer Ek Dersi
                    if (hourDetails.seminerEkDers > 0) {
                        html += `<tr><td>Seminer Dönemi Ek Dersi</td><td>${hourDetails.seminerEkDers}</td></tr>`;
                        totalEkDers += hourDetails.seminerEkDers;
                    }

                    // 5. Nöbet (Tablodan alınır)
                    const nobet = parseFloat(nobetSaat) || 0;
                    if (nobet > 0) {
                        html += `<tr><td>Nöbet Görevi</td><td>${nobet}</td></tr>`;
                        totalEkDers += nobet;
                    }

                    // 6. Rehberlik (Tablodan alınır)
                    const rehberlik = parseFloat(rehberlikSaat) || 0;
                    if (rehberlik > 0) {
                        html += `<tr><td>Rehberlik (Pansiyon vb.)</td><td>${rehberlik}</td></tr>`;
                        totalEkDers += rehberlik;
                    }

                    tbody.innerHTML = html;
                    document.getElementById('ekders-toplam').textContent = totalEkDers;

                } catch (error) {
                    console.error("Ek ders detayı hesaplanırken hata:", error);
                    tbody.innerHTML = '<tr><td colspan="2" style="color:red;">Detaylar hesaplanamadı.</td></tr>';
                }
            }


            async function renderGrandTotals(nobetVerisi = {}, personelListesi, calculatedHoursMap) {
                const year = parseInt(document.getElementById('input-year').value);
                const month = parseInt(document.getElementById('select-month').value);
                const educationPeriods = await fetchEducationPeriods();

                let totalEkders = 0, totalNobet = 0, totalRehberlik = 0;

                personelListesi.forEach(personel => {
                    const monthlyHours = calculatedHoursMap.get(personel.uniquePeriodId) || { ekDers: 0 };

                    if (personel.neviAdi.includes('Eğitim Personeli') || personel.unvan.includes('Müdür')) {
                        totalEkders += monthlyHours.ekDers;
                    }

                    totalNobet += nobetVerisi[personel.id] || 0;
                    totalRehberlik += calculateEffectiveRehberlikHours(personel.uniquePeriodId, year, month, puantajData, educationPeriods);
                });

                document.getElementById('total-ekders').textContent = totalEkders + " Saat";
                document.getElementById('total-nobet').textContent = totalNobet + " Saat";
                document.getElementById('total-rehberlik').textContent = totalRehberlik + " Saat";
            }


            function calculateEffectiveRehberlikHours(uniquePeriodId, year, month, allPuantajData, educationPeriods) {
                const personelPeriodData = allPuantajData[uniquePeriodId];
                if (!personelPeriodData || personelPeriodData.rehberlik_gorevi !== 'evet') {
                    return 0;
                }

                if (!educationPeriods || educationPeriods.length === 0) {
                    return 0; // Eğer hiç eğitim dönemi tanımlanmamışsa, rehberlik 0'dır.
                }

                let effectiveHours = 0;
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const personelMonthData = personelPeriodData.dailyData;

                if (!personelMonthData) {
                    return 0;
                }

                for (let day = 1; day <= daysInMonth; day++) {
                    const currentDate = new Date(Date.UTC(year, month, day));

                    if (currentDate.getUTCDay() === 4) { // Sadece Perşembe günlerini kontrol et
                        const dateString = currentDate.toISOString().split('T')[0];
                        const dayStatus = personelMonthData[dateString]?.code;
                        const isDuringSchoolTerm = educationPeriods.some(p => currentDate >= p.baslangic && currentDate <= p.bitis);

                        if (dayStatus === 'N' && isDuringSchoolTerm) {
                            effectiveHours += 2;
                        }
                    }
                }
                return effectiveHours;
            }


            function renderLegend() {
                const legendContainer = document.getElementById('puantaj-legend');
                if (!legendContainer) return;
                legendContainer.innerHTML = '';
                const statusCodes = {
                    'N': 'Normal',
                    'HT': 'Hafta Sonu',
                    'RT': 'Resmi Tatil',
                    'İ': 'İzinli (Ücretli)',
                    'R': 'Raporlu',
                    'Üİ': 'Ücretsiz İzin',
                    'S': 'Yıllık İzin',
                    'K': 'Yarım Gün Çalışma',
                    'Y': 'Yarım Gün Çalışma (Kısmi)',
                    'RTÇ': 'Resmi Tatil Çalışması',
                    'E': 'Eksik Gün'
                };
                for (const code in statusCodes) {
                    const item = document.createElement('div');
                    item.className = 'legend-item';
                    item.innerHTML = `<span class="legend-color-box status-${code}"></span><b>(${code})</b>: ${statusCodes[code]}`;
                    legendContainer.appendChild(item);
                }
            }
            function calculateFazlaMesai(personelId) {
                const personelData = puantajData[personelId];
                if (!personelData || !personelData.dailyData) return 0;

                const weeklyHours = {};
                const getWeekNumber = (d) => {
                    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
                    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
                    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
                    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
                };

                for (const dateString in personelData.dailyData) {
                    const dayData = personelData.dailyData[dateString];
                    if (dayData.code === 'N' || dayData.code === 'RTÇ' || dayData.code === 'Y' || dayData.code === 'K') {
                        const date = new Date(dateString + 'T00:00:00');
                        const weekNumber = getWeekNumber(date);

                        if (!weeklyHours[weekNumber]) {
                            weeklyHours[weekNumber] = 0;
                        }
                        weeklyHours[weekNumber] += (dayData.hours || 0);
                    }
                }

                let totalOvertime = 0;
                for (const week in weeklyHours) {
                    if (weeklyHours[week] > 45) {
                        totalOvertime += (weeklyHours[week] - 45);
                    }
                }
                return totalOvertime;
            }

            async function loadSharedData() {
                try {
                    const [siniflarSnap, personelSnap, neviSnap, derslerSnap] = await Promise.all([
                        getSettings('ayarlar_siniflar'),
                        getDocs(query(collection(db, 'personel'), where("okulId", "==", currentUserOkulId), orderBy('ad_soyad'))),
                        getSettings('ayarlar_personel_nevileri'),
                        getSettings('ayarlar_dersler')
                    ]);

                    window.classList = siniflarSnap.docs.map(d => d.data().name);

                    const egitimPersoneliNevi = neviSnap.docs.find(doc => doc.data().name.trim().includes('Eğitim Personeli'));
                    const egitimPersoneliNeviId = egitimPersoneliNevi ? egitimPersoneliNevi.id : null;


                    const bugun = new Date();
                    bugun.setHours(0, 0, 0, 0);

                    window.teacherList = personelSnap.docs
                        .filter(doc => {
                            const p = doc.data();
                            const ayrilisTarihi = p.isten_ayrilis ? new Date(p.isten_ayrilis) : null;
                            const isTeacher = p.personel_nevisi === egitimPersoneliNeviId;
                            const isActive = !ayrilisTarihi || ayrilisTarihi > bugun;
                            return isTeacher && isActive;
                        })
                        .map(doc => ({ id: doc.id, name: doc.data().ad_soyad }));

                    const dersFiltreSelect = document.getElementById('kural-filter-ders-select');
                    const ogretmenFiltreSelect = document.getElementById('kural-filter-ogretmen-select');
                    const sinifTableFiltreSelect = document.getElementById('kural-table-filter-sinif-select');

                    if (dersFiltreSelect) {
                        dersFiltreSelect.innerHTML = '<option value="">Tüm Dersler</option>';
                        derslerSnap.forEach(doc => dersFiltreSelect.add(new Option(doc.data().name, doc.id)));
                    }

                    if (sinifTableFiltreSelect) {
                        sinifTableFiltreSelect.innerHTML = '<option value="">Tüm Sınıflar</option>';
                        siniflarSnap.forEach(doc => sinifTableFiltreSelect.add(new Option(doc.data().name, doc.data().name)));
                    }

                    if (ogretmenFiltreSelect) {
                        ogretmenFiltreSelect.innerHTML = '<option value="">Tüm Öğretmenler</option>';
                        personelSnap.forEach(doc => {
                            if (doc.data().personel_nevisi === egitimPersoneliNeviId) {
                                ogretmenFiltreSelect.add(new Option(doc.data().ad_soyad, doc.id));
                            }
                        });
                    }

                } catch (error) {
                    console.error("Paylaşılan veriler yüklenirken kritik hata:", error);
                    showToast('Uygulama için temel veriler yüklenemedi. Ayarlarınızı kontrol edin.', 'error');
                }
            }
            function resetApplicationState(isFullReset = false) {


                if (isFullReset) {
                    currentUserOkulId = null;
                    isCurrentUserSuperAdmin = false;
                }

                tumPersonelListesi = [];
                puantajData = {};
                overtimeReasons = {};
                missingDayCodes = {};
                isPuantajLocked = false;
                currentPuantajDocRef = null;
                window.tumProgramlar = {};
                window.classList = [];
                window.teacherList = [];
                geciciDetaylar = [];
                duzenlenenGorevDetaylari = [];

                document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
                document.getElementById('dashboard').classList.add('active');

                document.querySelectorAll('.nav-link, .accordion-trigger').forEach(el => el.classList.remove('active'));
                document.querySelector('.nav-link[data-target="dashboard"]').classList.add('active');

                const elementsToReset = {
                    'db-aktif-personel': { property: 'textContent', value: '...' },
                    'db-gunun-nobetcileri-list': { property: 'innerHTML', value: '...' },
                    'db-bugun-izinliler-list': { property: 'innerHTML', value: '...' },
                    'db-bugun-gorevli-list': { property: 'innerHTML', value: '...' },
                    'db-aylik-ekders': { property: 'textContent', value: '...' },
                    'db-aylik-nobet': { property: 'textContent', value: '...' },
                    'db-aylik-rehberlik': { property: 'textContent', value: '...' },
                    'db-aylik-raporlular-list': { property: 'innerHTML', value: '...' },
                    'personel-table-area': { property: 'innerHTML', value: '' },
                    'gorevlendirme-tbody': { property: 'innerHTML', value: '' },
                    'nobet-rapor-tbody': { property: 'innerHTML', value: '' },
                    'izin-kayitlari-tbody': { property: 'innerHTML', value: '' },
                    'puantaj-table-container': { property: 'innerHTML', value: '' },
                    'schedule-display-area': { property: 'innerHTML', value: '' },
                    'yerlestirme-havuzu-container': { property: 'innerHTML', value: '' },
                    'versiyon-listesi': { property: 'innerHTML', value: '' }
                };
                for (const id in elementsToReset) {
                    const el = document.getElementById(id);
                    if (el) {
                        el[elementsToReset[id].property] = elementsToReset[id].value;
                    }
                }

                if (isFullReset) {
                    const selectorContainer = document.getElementById('school-selector-container');
                    if (selectorContainer) selectorContainer.style.display = 'none';
                    if (window.schoolSlimSelect) {
                        window.schoolSlimSelect.setData([]);
                    }
                }
            }

            async function loadDataForCurrentSchool() {
                await loadSharedData();
                const dashboardLink = document.querySelector('.nav-link[data-target="dashboard"]');
                if (dashboardLink) {

                    document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
                    document.getElementById('dashboard').classList.add('active');
                    document.querySelectorAll('.nav-link, .accordion-trigger').forEach(el => el.classList.remove('active'));
                    dashboardLink.classList.add('active');
                    await renderDashboardData();
                }
            }

            async function initializeSchoolSelector(okullar) { // Fonksiyon artık 'okullar' parametresini alıyor
                const selectorContainer = document.getElementById('school-selector-container');
                if (window.schoolSlimSelect) {
                    window.schoolSlimSelect.destroy();
                }
                if (okullar && okullar.length > 1) {
                    const dataForSlimSelect = okullar.map(okul => {
                        const okulAdiLower = okul.adi.toLowerCase();
                        let cssClass = 'option-diger';
                        if (okulAdiLower.includes('anaokulu')) {
                            cssClass = 'option-anaokulu';
                        } else if (okulAdiLower.includes('ilkokul')) {
                            cssClass = 'option-ilkokul';
                        } else if (okulAdiLower.includes('ortaokul')) {
                            cssClass = 'option-ortaokul';
                        }

                        return {
                            text: okul.adi,
                            value: okul.id,
                            class: cssClass
                        };
                    });

                    window.schoolSlimSelect = new SlimSelect({
                        select: '#school-selector',
                        settings: {
                            showSearch: false,
                            placeholderText: 'Okul Seçin',
                        },
                        data: dataForSlimSelect,
                        events: {
                            afterChange: async (newVal) => {


                                if (!newVal || newVal.length === 0) {
                                    return;
                                }
                                const yeniOkulId = newVal[0].value;
                                if (yeniOkulId === currentUserOkulId) return;

                                showSpinner();
                                resetApplicationState(false);
                                currentUserOkulId = yeniOkulId;
                                await loadDataForCurrentSchool();
                                hideSpinner();
                            }
                        }
                    });

                    window.schoolSlimSelect.setSelected(currentUserOkulId);
                    selectorContainer.style.display = 'block';
                } else {
                    selectorContainer.style.display = 'none';
                }
            }
            async function fetchIzinDataForPuantaj(year, month) {
                const startDate = new Date(Date.UTC(year, month, 1));
                const endDate = new Date(Date.UTC(year, month + 1, 0));
                const izinVerisi = {};

                try {
                    const [izinlerSnap, izinTipiSnap] = await Promise.all([
                        getDocs(query(
                            collection(db, 'izinler'),
                            where("okulId", "==", currentUserOkulId),
                            where('baslangicTarihi', '<=', endDate.toISOString().split('T')[0]),
                        )),
                        getSettings('ayarlar_izin_tipleri')
                    ]);

                    const izinTipiMap = new Map(izinTipiSnap.docs.map(doc => [doc.id, doc.data().kod]));

                    const relevantIzinler = izinlerSnap.docs.filter(doc => {
                        const bitisTarihi = doc.data().bitisTarihi;
                        return bitisTarihi >= startDate.toISOString().split('T')[0];
                    });

                    for (const doc of relevantIzinler) {
                        const izin = doc.data();
                        const personelId = izin.personelId;
                        const kod = izinTipiMap.get(izin.izinTipiId) || 'İ';

                        if (!izinVerisi[personelId]) {
                            izinVerisi[personelId] = {};
                        }

                        let currentDate = new Date(izin.baslangicTarihi + 'T00:00:00Z');
                        const endDateIzin = new Date(izin.bitisTarihi + 'T00:00:00Z');

                        while (currentDate <= endDateIzin) {
                            if (currentDate >= startDate && currentDate <= endDate) {
                                const dateString = currentDate.toISOString().split('T')[0];
                                izinVerisi[personelId][dateString] = kod;
                            }
                            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
                        }
                    }
                    return izinVerisi;

                } catch (error) {
                    console.error("İzin verileri çekilirken hata oluştu:", error);
                    showToast('Puantaj için izin verileri çekilemedi.', 'error');
                    return {};
                }
            }

async function fetchGorevlendirmeDataForPuantaj(year, month) {
                const startDate = new Date(Date.UTC(year, month, 1));
                const endDate = new Date(Date.UTC(year, month + 1, 0));
                const startDateString = startDate.toISOString().split('T')[0];
                const endDateString = endDate.toISOString().split('T')[0];

                const asilOgretmenMap = new Map();
                const gorevliOgretmenMap = new Map();

                try {
                    const q = query(collection(db, 'ders_gorevlendirmeleri'),
                        where("okulId", "==", currentUserOkulId),
                        where("tarih", ">=", startDateString),
                        where("tarih", "<=", endDateString));

                    const snapshot = await getDocs(q);

                    snapshot.forEach(doc => {
                        const g = doc.data();
                        const tarih = g.tarih;
                        const asilId = g.asilId;
                        const detaylar = g.detaylar || [];

                        if (!asilOgretmenMap.has(tarih)) {
                            asilOgretmenMap.set(tarih, new Map());
                        }
                        if (!gorevliOgretmenMap.has(tarih)) {
                            gorevliOgretmenMap.set(tarih, new Map());
                        }

                        let asilOgretmeninOgunVerdigiDersSayisi = 0;

                        detaylar.forEach(d => {
                            const gorevliId = d.gorevliId;
                            if (gorevliId) { 
                                asilOgretmeninOgunVerdigiDersSayisi++;
                                
                                const gorevliGunlukMap = gorevliOgretmenMap.get(tarih);
                                gorevliGunlukMap.set(gorevliId, (gorevliGunlukMap.get(gorevliId) || 0) + 1);
                            }
                        });

                        if (asilOgretmeninOgunVerdigiDersSayisi > 0) {
                            const asilGunlukMap = asilOgretmenMap.get(tarih);
                            asilGunlukMap.set(asilId, (asilGunlukMap.get(asilId) || 0) + asilOgretmeninOgunVerdigiDersSayisi);
                        }
                    });

                    return [asilOgretmenMap, gorevliOgretmenMap];

                } catch (error) {
                    console.error("Puantaj için görevlendirme verileri çekilirken hata:", error);
                    showToast('Görevlendirme verileri puantaja yansıtılamadı.', 'error');
                    return [new Map(), new Map()];
                }
            }


            let advancedBulkUpdateVisible = false;
            async function initializePuantaj() {
                if (puantajInitialized) {
                    await loadAndFilterPersonelList();
                    await loadPuantajDataForCurrentMonth();
                    populateAdvancedBulkPersonnelSelect();
                    return;
                }
                try {
                    await loadAndFilterPersonelList();
                    const selectMonth = document.getElementById('select-month');
                    const inputYear = document.getElementById('input-year');
                    const showBtn = document.getElementById('btn-show-puantaj');
                    const generateBtn = document.getElementById('btn-generate');
                    const printBtn = document.getElementById('btn-print');
                    const deleteBtn = document.getElementById('btn-delete-puantaj');
                    const pdfBtn = document.getElementById('btn-pdf');
                    const excelBtn = document.getElementById('btn-excel');
                    const modalOverlay = document.getElementById('edit-modal-overlay');
                    const modalSaveBtn = document.getElementById('modal-save');
                    const modalCancelBtn = document.getElementById('modal-cancel');
                    const savePuantajBtn = document.getElementById('btn-save-puantaj');
                    const lockPuantajBtn = document.getElementById('btn-lock-puantaj');
                    modalSaveBtn.addEventListener('click', saveModalChanges);
                    modalCancelBtn.addEventListener('click', () => { modalOverlay.style.display = 'none'; });
                    const now = new Date();
                    const months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
                    selectMonth.innerHTML = '';
                    months.forEach((m, i) => selectMonth.add(new Option(m, i)));
                    selectMonth.value = now.getMonth();
                    inputYear.value = now.getFullYear();
                    const statusCodes = {
                        'N': 'Normal', 'HT': 'Hafta Sonu', 'RT': 'Resmi Tatil', 'İ': 'İzinli (Ücretli)',
                        'R': 'Raporlu', 'Üİ': 'Ücretsiz İzin', 'S': 'Yıllık İzin', 'K': 'Yarım Gün Çalışma',
                        'Y': 'Yarım Gün Çalışma (Kısmi)', 'RTÇ': 'Resmi Tatil Çalışması', 'E': 'Eksik Gün'
                    };
                    const modalStatusSelect = document.getElementById('modal-status');
                    modalStatusSelect.innerHTML = '';
                    for (const code in statusCodes) modalStatusSelect.add(new Option(statusCodes[code], code));

                    if (!puantajInitialized) {
                        showBtn.addEventListener('click', loadPuantajDataForCurrentMonth);
                        generateBtn.addEventListener('click', () => {
                            showConfirmationModal(
                                'Mevcut ay için yeni bir puantaj cetveli oluşturulacaktır. Varsa, kaydedilmemiş mevcut veriler kaybolacaktır. Emin misiniz?',
                                generateInitialPuantaj, 'Evet, Oluştur', 'add'
                            );
                        });
                        document.getElementById('btn-generate-individual').addEventListener('click', generateIndividualPuantaj);
                        deleteBtn.addEventListener('click', deleteCurrentPuantaj);
                        savePuantajBtn.addEventListener('click', savePuantajData);
                        lockPuantajBtn.addEventListener('click', togglePuantajLock);
                        printBtn.addEventListener('click', printPuantaj);
                        pdfBtn.addEventListener('click', downloadPdf);
                        excelBtn.addEventListener('click', downloadExcel);
                        const toggleBtn = document.getElementById('toggle-bulk-update-btn');
                        const advancedContainer = document.getElementById('advanced-bulk-update-container');
                        toggleBtn.addEventListener('click', () => {
                            advancedBulkUpdateVisible = !advancedBulkUpdateVisible;
                            advancedContainer.style.display = advancedBulkUpdateVisible ? 'grid' : 'none';
                            if (advancedBulkUpdateVisible) {
                                initializeAdvancedBulkSelects();
                            }
                        });
                        document.getElementById('btn-advanced-bulk-update').addEventListener('click', applyAdvancedBulkUpdate);
                        const updateBulkPanelOnDateChange = () => {
                            loadPuantajDataForCurrentMonth();
                            if (advancedBulkUpdateVisible) {
                                initializeAdvancedBulkSelects();
                            }
                        };
                        selectMonth.addEventListener('change', updateBulkPanelOnDateChange);
                        inputYear.addEventListener('change', updateBulkPanelOnDateChange);

                        document.getElementById('btn-filter-personel').addEventListener('click', loadPuantajDataForCurrentMonth);
                        document.getElementById('btn-clear-filter').addEventListener('click', () => {
                            document.getElementById('personel-filter-select').value = 'all';
                            loadPuantajDataForCurrentMonth();
                        });
                    }
                    puantajInitialized = true;
                    await loadPuantajDataForCurrentMonth();
                } catch (error) {
                    console.error("Puantaj başlatılırken kritik hata:", error);
                    showToast('Puantaj modülü başlatılamadı. Lütfen Ayarlarınızı kontrol edin.', 'error');
                }
            }

            function initializeAdvancedBulkSelects() {
                const year = parseInt(document.getElementById('input-year').value);
                const month = parseInt(document.getElementById('select-month').value);
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const daysSelect = document.getElementById('bulk-update-days-multi');
                const daysData = [];
                for (let i = 1; i <= daysInMonth; i++) {
                    daysData.push({ text: i.toString(), value: i.toString() });
                }
                if (daysSelect.slim) { daysSelect.slim.destroy(); }
                new SlimSelect({
                    select: daysSelect,
                    data: daysData,
                    settings: { placeholderText: 'Günleri Seçin' }
                });
                populateAdvancedBulkPersonnelSelect();
                const statusSelect = document.getElementById('bulk-update-status-new');
                if (statusSelect.options.length <= 1) {
                    const statusCodes = {
                        'N': 'Normal', 'HT': 'Hafta Sonu', 'RT': 'Resmi Tatil', 'İ': 'İzinli (Ücretli)',
                        'R': 'Raporlu', 'Üİ': 'Ücretsiz İzin', 'S': 'Yıllık İzin', 'K': 'Yarım Gün Çalışma',
                        'Y': 'Yarım Gün Çalışma (Kısmi)', 'RTÇ': 'Resmi Tatil Çalışması', 'E': 'Eksik Gün'
                    };
                    statusSelect.innerHTML = '<option value="">Durum Kodu Seçin</option>';
                    for (const code in statusCodes) {
                        statusSelect.add(new Option(`${statusCodes[code]} (${code})`, code));
                    }
                }
            }

            function populateAdvancedBulkPersonnelSelect() {
                const personnelSelect = document.getElementById('bulk-update-personnel-multi');
                const personnelData = [];
                const displayedPersonnelRows = Array.from(document.querySelectorAll('.puantaj-table .personel-row-status'));

                displayedPersonnelRows.forEach(row => {
                    const personelId = row.querySelector('.status-cell')?.dataset.personelId;
                    const personelName = row.querySelector('.col-personel')?.textContent;
                    if (personelId && personelName) {
                        personnelData.push({ text: personelName, value: personelId });
                    }
                });

                if (personnelSelect.slim) { personnelSelect.slim.destroy(); }
                new SlimSelect({
                    select: personnelSelect,
                    data: personnelData,
                    settings: { placeholderText: 'Personelleri Seçin' }
                });
            }

            function updateTableCell(personelId, dateString) {
                const dayData = puantajData[personelId]?.dailyData?.[dateString];
                if (!dayData) return;

                const statusCell = document.querySelector(`.status-cell[data-personel-id="${personelId}"][data-date="${dateString}"]`);
                if (statusCell) {
                    statusCell.textContent = dayData.code || '';
                    statusCell.className = 'status-cell vertical-divider status-' + dayData.code; // vertical-divider sınıfını koru
                    const dayOfMonth = new Date(dateString + 'T00:00:00Z').getUTCDate();
                    if (new Date(dateString).getDay() !== 0 && dayOfMonth !== new Date(new Date(dateString).getFullYear(), new Date(dateString).getMonth() + 1, 0).getDate()) {
                        statusCell.classList.remove('vertical-divider');
                    }
                }

                const hourRow = statusCell?.closest('tr')?.nextElementSibling;
                if (hourRow) {
                    const hourCell = hourRow.querySelector(`td:nth-of-type(${new Date(dateString).getUTCDate()})`);
                    if (hourCell) {
                        const hourContent = (['N', 'RTÇ', 'Y', 'K'].includes(dayData.code)) && dayData.hours > 0 ? dayData.hours : '';
                        hourCell.textContent = hourContent;
                    }
                }
            }


            function applyAdvancedBulkUpdate() {
                const selectedDays = document.getElementById('bulk-update-days-multi').slim.getSelected();
                const selectedPersonnel = document.getElementById('bulk-update-personnel-multi').slim.getSelected();
                const newStatus = document.getElementById('bulk-update-status-new').value;
                const newHoursRaw = document.getElementById('bulk-update-hours-new').value;

                if (selectedDays.length === 0 || selectedPersonnel.length === 0) {
                    return showToast('Lütfen en az bir gün ve bir personel seçin.', 'error');
                }
                if (!newStatus && newHoursRaw === '') {
                    return showToast('Lütfen yeni bir durum kodu veya yeni bir saat değeri girin.', 'error');
                }

                const year = parseInt(document.getElementById('input-year').value);
                const month = parseInt(document.getElementById('select-month').value);
                let updatedCellCount = 0;

                selectedPersonnel.forEach(personelId => {
                    if (!puantajData[personelId] || !puantajData[personelId].dailyData) return;

                    selectedDays.forEach(day => {
                        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

                        if (puantajData[personelId].dailyData[dateString]) {
                            if (newStatus) {
                                puantajData[personelId].dailyData[dateString].code = newStatus;
                            }
                            if (newHoursRaw !== '') {
                                puantajData[personelId].dailyData[dateString].hours = parseFloat(newHoursRaw) || 0;
                            }

                            updateTableCell(personelId, dateString);
                            updatedCellCount++;
                        }
                    });
                });

                if (updatedCellCount > 0) {
                    showToast(`${updatedCellCount} hücre güncellendi. Kalıcı yapmak için 'Kaydet' butonuna tıklayın.`, 'success');
                } else {
                    showToast('Güncellenecek uygun hücre bulunamadı.', 'info');
                }
            }

            async function loadAndFilterPersonelList() {
                try {
                    const personelSnap = await getDocs(query(collection(db, "personel"), where("okulId", "==", currentUserOkulId), orderBy("ad_soyad")));
                    const gorevSnap = await getSettings('ayarlar_gorevler');
                    const neviSnap = await getSettings('ayarlar_personel_nevileri');
                    const gorevMap = new Map(gorevSnap.docs.map(doc => [doc.id, doc.data().name]));
                    const neviMap = new Map(neviSnap.docs.map(doc => [doc.id, doc.data().name]));
                    puantajPersonelList = personelSnap.docs.map(doc => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            ad: data.ad_soyad || 'İsimsiz',
                            unvan: gorevMap.get(data.gorevi_bransi) || 'Belirtilmemiş',
                            neviAdi: neviMap.get(data.personel_nevisi) || 'Bilinmiyor',
                            maasKarsiligi: parseInt(data.maas_karsiligi) || 20,
                            rehberlik_gorevi: data.rehberlik_gorevi || 'hayir',
                            esDurumu: data.es_durumu,
                            cocuk0_6: data.cocuk_0_6,
                            cocuk6_18: data.cocuk_6_ustu,
                            sozlesme_turu: data.sozlesme_turu || 'Belirsiz Süreli',
                            ise_giris: data.ise_giris || '---',
                            isten_ayrilis: data.isten_ayrilis || '---',
                            kismi_zamanli_calisma: data.kismi_zamanli_calisma || {}
                        };
                    });
                    const personelFilterSelect = document.getElementById('personel-filter-select');
                    personelFilterSelect.innerHTML = '<option value="all">Tüm Personeli Göster</option>';
                    puantajPersonelList.forEach(personel => {
                        personelFilterSelect.add(new Option(personel.ad, personel.id));
                    });
                } catch (error) {
                    console.error("Personel listesi yüklenirken hata:", error);
                    showToast("Personel listesi yüklenemedi. Ayarlarınızı kontrol edin.", "error");
                }
            }

            function calculateStatusCounts(uniquePeriodId) {
                const personelPuantajVerisi = puantajData[uniquePeriodId];
                if (!personelPuantajVerisi || !personelPuantajVerisi.dailyData) {
                    return { N: 0, HT: 0, RT: 0, İ: 0, R: 0, Üİ: 0, S: 0, K: 0, RTÇ: 0 };
                }
                const counts = { N: 0, HT: 0, RT: 0, İ: 0, R: 0, Üİ: 0, S: 0, K: 0, RTÇ: 0 };
                for (const date in personelPuantajVerisi.dailyData) {
                    let dayCode = personelPuantajVerisi.dailyData[date].code;
                    if (dayCode === 'UI' || dayCode === 'üi') dayCode = 'Üİ';
                    if (dayCode === 'i' || dayCode === 'I') dayCode = 'İ';
                    if (counts.hasOwnProperty(dayCode)) {
                        counts[dayCode]++;
                    }
                }
                return counts;
            }

            function handleCustomSelectDisplay(selectElement) {
                if (!selectElement) return;
                Array.from(selectElement.options).forEach(option => {
                    if (option.value) {
                        const kodBilgisi = eksikGunKodlari.find(k => k.kod === option.value);
                        if (kodBilgisi) {
                            option.textContent = `${kodBilgisi.kod} - ${kodBilgisi.aciklama}`;
                        }
                    }
                });
                const selectedOption = selectElement.options[selectElement.selectedIndex];
                if (selectedOption && selectedOption.value) {
                    selectedOption.textContent = selectedOption.value;
                }
            }

            function initializeCustomSelects() {
                const customSelects = document.querySelectorAll('.missing-day-code-select');
                customSelects.forEach(select => {
                    handleCustomSelectDisplay(select);
                    select.addEventListener('focus', () => {
                        Array.from(select.options).forEach(option => {
                            if (option.value) {
                                const kodBilgisi = eksikGunKodlari.find(k => k.kod === option.value);
                                if (kodBilgisi) {
                                    option.textContent = `${kodBilgisi.kod} - ${kodBilgisi.aciklama}`;
                                }
                            }
                        });
                    });
                    select.addEventListener('change', () => handleCustomSelectDisplay(select));
                    select.addEventListener('blur', () => handleCustomSelectDisplay(select));
                });
            }
            async function loadPuantajDataForCurrentMonth() {
                const year = document.getElementById('input-year').value;
                const month = document.getElementById('select-month').value;
                const docId = `${currentUserOkulId}_${year}-${String(parseInt(month) + 1).padStart(2, '0')}`;
                currentPuantajDocRef = doc(db, "kayitli_puantajlar", docId);
                const container = document.getElementById('puantaj-table-container');
                container.innerHTML = `<div style="padding: 40px; text-align: center; background-color: #f8f9fa; border-radius: 8px;"><h4>Puantaj verileri yükleniyor ve hesaplamalar yapılıyor...</h4></div>`;
                try {
                    const ayAdi = document.getElementById('select-month').options[month].text;
                    const okulAdi = await getCurrentSchoolName();
                    const baslikMetni = `${okulAdi.toLocaleUpperCase('tr-TR')} ${year} YILI ${ayAdi.toLocaleUpperCase('tr-TR')} AYI PERSONEL PUANTAJ CETVELİ`; const docSnap = await getDoc(currentPuantajDocRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        puantajData = data.puantajData || {};
                        overtimeReasons = data.overtimeReasons || {};
                        missingDayCodes = data.missingDayCodes || {};
                        isPuantajLocked = data.isLocked || false;
                        showToast('Kaydedilmiş puantaj verisi yüklendi.', 'success');
                    } else {
                        puantajData = {};
                        overtimeReasons = {};
                        missingDayCodes = {};
                        isPuantajLocked = false;
                        showToast('Bu ay için kaydedilmiş bir puantaj yok.', 'info');
                    }
                    updateLockStatusUI();
                    const personelPeriods = await getPersonelPeriodsForMonth(year, parseInt(month));
                    const selectedPersonelId = document.getElementById('personel-filter-select').value;
                    let displayList = personelPeriods;
                    if (selectedPersonelId && selectedPersonelId !== 'all') {
                        displayList = personelPeriods.filter(p => p.id === selectedPersonelId);
                    }
                    const nobetVerisi = await fetchAndCalculateNobetData(year, parseInt(month));
                    const calculatedHoursMap = new Map();
                    const hourCalculationPromises = displayList.map(async (personel) => {
                        const hours = await calculateMonthlyHours(personel.uniquePeriodId);
                        calculatedHoursMap.set(personel.uniquePeriodId, hours);
                    });
                    await Promise.all(hourCalculationPromises);
                    await renderPuantajTable(nobetVerisi, displayList, baslikMetni, calculatedHoursMap);
                    await renderGrandTotals(nobetVerisi, displayList, calculatedHoursMap);
                    renderLegend();
                    attachCellListeners();
                } catch (error) {
                    console.error("Puantaj verisi yüklenirken hata: ", error);
                    showToast("Puantaj verisi yüklenemedi.", "error");
                    container.innerHTML = `<div style="padding: 40px; text-align: center; background-color: #f8f9fa; border-radius: 8px;"><h4 style="color: var(--danger-color);">Puantaj yüklenirken bir hata oluştu. Lütfen Console'u kontrol edin.</h4></div>`;
                }
            }

            async function savePuantajData() {
                if (isPuantajLocked) {
                    showToast('Puantaj kilitli olduğu için kaydedilemez.', 'error');
                    return;
                }
                if (Object.keys(puantajData).length === 0) {
                    showToast('Kaydedilecek puantaj verisi bulunmuyor.', 'error');
                    return;
                }
                if (!currentPuantajDocRef) {
                    const year = document.getElementById('input-year').value;
                    const month = document.getElementById('select-month').value;
                    const docId = `${currentUserOkulId}_${year}-${String(parseInt(month) + 1).padStart(2, '0')}`;
                    currentPuantajDocRef = doc(db, "kayitli_puantajlar", docId);
                }
                const newOvertimeReasons = {};
                document.querySelectorAll('.overtime-reason-input').forEach(input => {
                    if (input.value.trim() !== '') {
                        newOvertimeReasons[input.dataset.personelId] = input.value.trim();
                    }
                });
                overtimeReasons = newOvertimeReasons;
                const newMissingDayCodes = {};
                document.querySelectorAll('.missing-day-code-select').forEach(select => {
                    if (select.value) {
                        newMissingDayCodes[select.dataset.personelId] = select.value;
                    }
                });
                missingDayCodes = newMissingDayCodes;
                try {
                    await setDoc(currentPuantajDocRef, {
                        puantajData: puantajData,
                        isLocked: isPuantajLocked,
                        overtimeReasons: overtimeReasons,
                        missingDayCodes: missingDayCodes,
                        okulId: currentUserOkulId
                    }, {
                        merge: true
                    });
                    showToast('Puantaj başarıyla kaydedildi!', 'success');
                } catch (error) {
                    console.error("Puantaj kaydedilirken hata: ", error);
                    showToast('Puantaj kaydedilemedi.', 'error');
                }
            }

            async function togglePuantajLock() {
                isPuantajLocked = !isPuantajLocked;
                try {
                    if (!currentPuantajDocRef) {
                        const year = document.getElementById('input-year').value;
                        const month = document.getElementById('select-month').value;
                        const docId = `${currentUserOkulId}_${year}-${String(parseInt(month) + 1).padStart(2, '0')}`;
                        currentPuantajDocRef = doc(db, "kayitli_puantajlar", docId);
                    }
                    await setDoc(currentPuantajDocRef, {
                        isLocked: isPuantajLocked,
                        okulId: currentUserOkulId
                    }, {
                        merge: true
                    });
                    showToast(isPuantajLocked ? 'Puantaj kilitlendi.' : 'Puantaj kilidi açıldı.', 'success');
                    updateLockStatusUI();
                } catch (error) {
                    console.error("Kilit durumu güncellenirken hata:", error);
                    showToast("Kilit durumu güncellenemedi.", "error");
                    isPuantajLocked = !isPuantajLocked;
                }
            }
            async function deleteCurrentPuantaj() {
                if (isPuantajLocked) {
                    showToast('Puantaj kilitli. Silmek için önce kilidi açmalısınız.', 'error');
                    return;
                }
                if (!currentPuantajDocRef) {
                    showToast('Bu ay için silinecek kayıtlı bir puantaj bulunmuyor.', 'error');
                    return;
                }
                const year = document.getElementById('input-year').value;
                const monthName = document.getElementById('select-month').options[document.getElementById('select-month').selectedIndex].text;
                if (!confirm(`${monthName} ${year} ayına ait puantaj cetvelini kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
                    return;
                }
                try {
                    await deleteDoc(currentPuantajDocRef);
                    puantajData = {};
                    isPuantajLocked = false;
                    currentPuantajDocRef = null;
                    updateLockStatusUI();
                    renderPuantajTable({}, [], '');
                    await renderGrandTotals({}, []);
                    showToast('Puantaj başarıyla silindi.', 'success');
                } catch (error) {
                    console.error("Puantaj silinirken hata:", error);
                    showToast('Puantaj silinirken bir hata oluştu.', 'error');
                }
            }

            function updateLockStatusUI() {
                const lockBtn = document.getElementById('btn-lock-puantaj');
                const generateBtn = document.getElementById('btn-generate');
                if (isPuantajLocked) {
                    lockBtn.textContent = 'Kilidi Aç';
                    lockBtn.style.backgroundColor = '#17a2b8';
                    generateBtn.disabled = true;
                } else {
                    lockBtn.textContent = 'Puantajı Kilitle';
                    lockBtn.style.backgroundColor = '#fd7e14';
                    generateBtn.disabled = false;
                }
            }


                onAuthStateChanged(auth, async (user) => {
                    if (user) {
                        try {
                            const idTokenResult = await user.getIdTokenResult(true);
                            const claims = idTokenResult.claims;
                            isCurrentUserSuperAdmin = !!claims.superadmin;
                            const superAdminLink = document.getElementById('super-admin-link');

                            loginPanel.style.display = 'none';
                            appContainer.style.display = 'flex';

                            if (isCurrentUserSuperAdmin) {
                                superAdminLink.style.display = 'block';

                                const okullarQuery = query(collection(db, "okullar"), where("durum", "!=", "pasif"));
                                const okullarSnapshot = await getDocs(okullarQuery);
                                const okullar = okullarSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                                if (okullar.length > 0) {
                                    let varsayilanOkul = okullar.find(okul => okul.adi.toLowerCase().includes('ortaokul'));
                                    if (!varsayilanOkul) {
                                        varsayilanOkul = okullar[0];
                                    }
                                    currentUserOkulId = varsayilanOkul.id;

                                    await initializeSchoolSelector(okullar);
                                    if (window.schoolSlimSelect) {
                                        window.schoolSlimSelect.setSelected(currentUserOkulId);
                                    }
                                } else {
                                    showToast('Sistemde hiç aktif okul bulunamadı!', 'error');
                                    initializeApplicationUI();
                                    return;
                                }
                            } else {
                                currentUserOkulId = claims.okulId;
                                superAdminLink.style.display = 'none';
                                document.getElementById('school-selector-container').style.display = 'none';
                                if (!currentUserOkulId) {
                                    alert("Hata: Hesabınız bir okula atanmamış. Lütfen sistem yöneticisi ile iletişime geçin.");
                                    await signOut(auth);
                                    return;
                                }
                            }

                            const userEmailDisplay = document.getElementById('user-email-display');
                            if (userEmailDisplay) {
                                userEmailDisplay.textContent = user.email;
                            }

                            await loadSharedData();
                            initializeApplicationUI();
                            await renderDashboardData();

                        } catch (error) {
                            console.error("Oturum doğrulanırken hata oluştu:", error);
                            alert("Oturum doğrulanırken bir hata oluştu. Lütfen tekrar giriş yapın.");
                            await signOut(auth);
                        }
                    } else {
                        const userEmailDisplay = document.getElementById('user-email-display');
                        if (userEmailDisplay) {
                            userEmailDisplay.textContent = '';
                        }


                        currentUserOkulId = null;
                        isCurrentUserSuperAdmin = false;
                        loginPanel.style.display = 'flex';
                        appContainer.style.display = 'none';
                        resetApplicationState(true);
                    }
                });
          

           
            let zamanCizelgesiAyarlari = {};
            const loginPanel = document.getElementById('login-panel');
            const appContainer = document.querySelector('.app-container');


            const loginEmailInput = document.getElementById('login-email');
            const loginPasswordInput = document.getElementById('login-password');
            const loginError = document.getElementById('login-error');
            const loginBtn = document.getElementById('login-btn');
            const logoutBtn = document.getElementById('logout-btn');

            loginBtn.addEventListener('click', async () => {
                const email = loginEmailInput.value;
                const password = loginPasswordInput.value;
                loginError.style.display = 'none';

                if (!email || !password) {
                    loginError.textContent = 'Lütfen e-posta ve şifre alanlarını doldurun.';
                    loginError.style.display = 'block';
                    return;
                }

                try {
                    await signInWithEmailAndPassword(auth, email, password);
                } catch (error) {
                    console.error("Giriş hatası:", error);
                    loginError.textContent = 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.';
                    loginError.style.display = 'block';
                }
            });

            const loginInputs = [document.getElementById('login-email'), document.getElementById('login-password')];
            loginInputs.forEach(input => {
                input.addEventListener('keyup', function (event) {

                    if (event.key === 'Enter' || event.keyCode === 13) {

                        document.getElementById('login-btn').click();
                    }
                });
            });

            logoutBtn.addEventListener('click', async () => {
                try {
                    await signOut(auth);

                    resetApplicationState();
                    showToast('Başarıyla çıkış yapıldı.', 'info');
                } catch (error) {
                    console.error("Çıkış hatası:", error);
                    showToast('Çıkış yapılırken bir hata oluştu.', 'error');
                }
            });
            function stringToColor(str) {
                let hash = 0;
                if (!str || str.length === 0) return '#f0f0f0';


                for (let i = 0; i < str.length; i++) {
                    hash = str.charCodeAt(i) + ((hash << 5) - hash);
                }


                const index = Math.abs(hash % COLOR_PALETTE.length);


                return COLOR_PALETTE[index];
            }

            function getContrastColor(bgColor) {
                const lightness = parseInt(bgColor.substring(bgColor.lastIndexOf(',') + 1, bgColor.lastIndexOf('%')).trim());
                return (lightness > 65) ? 'black' : 'white';
            }

            function showSpinner() {
                document.getElementById('global-spinner').style.display = 'flex';
            }

            function shuffleArray(array) {
                for (let i = array.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [array[i], array[j]] = [array[j], array[i]];
                }
            }

            function showProgressModal() {
                document.getElementById('scheduler-progress-bar').value = 0;
                document.getElementById('progress-percentage').textContent = '0';
                document.getElementById('progress-status-text').textContent = 'İşlem başlatılıyor...';
                document.getElementById('progress-modal').classList.add('open');
            }

            function updateProgress(percentage, statusText) {
                document.getElementById('scheduler-progress-bar').value = percentage;
                document.getElementById('progress-percentage').textContent = percentage;
                document.getElementById('progress-status-text').textContent = statusText;
            }

            function hideProgressModal() {
                document.getElementById('progress-modal').classList.remove('open');
            }

            function showConfirmationModal(message, onConfirm, buttonText = 'Onayla', buttonStyle = 'save') {
                const modal = document.getElementById('confirmation-modal');
                const messageEl = document.getElementById('confirmation-modal-message');
                const confirmBtn = document.getElementById('confirm-action-btn');
                const cancelBtn = document.getElementById('confirm-cancel-btn');
                const closeModalBtn = modal.querySelector('.close-modal');
                messageEl.innerHTML = message;
                confirmBtn.textContent = buttonText;
                confirmBtn.classList.remove('btn-delete', 'btn-save', 'btn-add');
                if (buttonStyle === 'delete') {
                    confirmBtn.classList.add('btn-delete');
                } else if (buttonStyle === 'add') {
                    confirmBtn.classList.add('btn-add');
                } else {
                    confirmBtn.classList.add('btn-save');
                }
                modal.classList.add('open');
                const close = () => {
                    modal.classList.remove('open');
                };
                const confirmAction = () => {
                    onConfirm();
                    close();
                };
                confirmBtn.onclick = confirmAction;
                cancelBtn.onclick = close;
                closeModalBtn.onclick = close;
            }

            function hideSpinner() {
                document.getElementById('global-spinner').style.display = 'none';
            }
            const eksikGunKodlari = [{
                kod: "01",
                aciklama: "İstirahat"
            }, {
                kod: "03",
                aciklama: "Disiplin cezası"
            }, {
                kod: "04",
                aciklama: "Gözaltına alınma"
            }, {
                kod: "05",
                aciklama: "Tutukluluk"
            }, {
                kod: "06",
                aciklama: "Kısmi istihdam"
            }, {
                kod: "07",
                aciklama: "Puantaj kayıtları"
            }, {
                kod: "08",
                aciklama: "Grev"
            }, {
                kod: "09",
                aciklama: "Lokavt"
            }, {
                kod: "10",
                aciklama: "Genel hayatı etkileyen olaylar"
            }, {
                kod: "11",
                aciklama: "Doğal afet"
            }, {
                kod: "12",
                aciklama: "Birden fazla"
            }, {
                kod: "13",
                aciklama: "Diğer nedenler"
            }, {
                kod: "15",
                aciklama: "Devamsızlık"
            }, {
                kod: "16",
                aciklama: "Fesih tarihinde çalışmamış"
            }, {
                kod: "17",
                aciklama: "Ev hizmetlerinde 30 günden az çalışma"
            }, {
                kod: "18",
                aciklama: "Kısa çalışma ödeneği"
            }, {
                kod: "19",
                aciklama: "Ücretsiz Doğum İzni"
            }, {
                kod: "20",
                aciklama: "Ücretsiz Yol İzni"
            }, {
                kod: "21",
                aciklama: "Diğer Ücretsiz İzin"
            }, {
                kod: "22",
                aciklama: "5434 SK. ek 76, GM 192"
            }, {
                kod: "23",
                aciklama: "Yarım çalışma ödeneği"
            }, {
                kod: "24",
                aciklama: "Yarım çalışma ödeneği ve diğer nedenler"
            }, {
                kod: "25",
                aciklama: "Diğer belge/kanun türlerinden gün tamamlama"
            }, {
                kod: "26",
                aciklama: "Kısmi istihdama izin verilen yabancı uyruklu sigortalı"
            }, {
                kod: "27",
                aciklama: "Kısa çalışma ödeneği ve diğer nedenler"
            }, {
                kod: "28",
                aciklama: "Pandemi Ücretsiz İzin (4857 Geç.10.Md.)"
            }, {
                kod: "29",
                aciklama: "Pandemi Ücretsiz İzin ve diğer nedenler"
            }];

            const resmiTatiller = {
                "sabit": [{
                    ay: 0,
                    gun: 1,
                    ad: "Yılbaşı"
                }, {
                    ay: 3,
                    gun: 23,
                    ad: "Ulusal Egemenlik ve Çocuk Bayramı"
                }, {
                    ay: 4,
                    gun: 1,
                    ad: "Emek ve Dayanışma Günü"
                }, {
                    ay: 4,
                    gun: 19,
                    ad: "Atatürk'ü Anma, Gençlik ve Spor Bayramı"
                }, {
                    ay: 6,
                    gun: 15,
                    ad: "Demokrasi ve Milli Birlik Günü"
                }, {
                    ay: 7,
                    gun: 30,
                    ad: "Zafer Bayramı"
                }, {
                    ay: 9,
                    gun: 29,
                    ad: "Cumhuriyet Bayramı"
                }],
                "degisken": {
                    "2024": [{
                        ay: 3,
                        gun: 9,
                        ad: "Ramazan Bayramı Arifesi"
                    }, {
                        ay: 3,
                        gun: 10,
                        ad: "Ramazan Bayramı 1. Gün"
                    }, {
                        ay: 3,
                        gun: 11,
                        ad: "Ramazan Bayramı 2. Gün"
                    }, {
                        ay: 3,
                        gun: 12,
                        ad: "Ramazan Bayramı 3. Gün"
                    }, {
                        ay: 5,
                        gun: 15,
                        ad: "Kurban Bayramı Arifesi"
                    }, {
                        ay: 5,
                        gun: 16,
                        ad: "Kurban Bayramı 1. Gün"
                    }, {
                        ay: 5,
                        gun: 17,
                        ad: "Kurban Bayramı 2. Gün"
                    }, {
                        ay: 5,
                        gun: 18,
                        ad: "Kurban Bayramı 3. Gün"
                    }, {
                        ay: 5,
                        gun: 19,
                        ad: "Kurban Bayramı 4. Gün"
                    }],
                    "2025": [{
                        ay: 2,
                        gun: 29,
                        ad: "Ramazan Bayramı Arifesi"
                    }, {
                        ay: 2,
                        gun: 30,
                        ad: "Ramazan Bayramı 1. Gün"
                    }, {
                        ay: 2,
                        gun: 31,
                        ad: "Ramazan Bayramı 2. Gün"
                    }, {
                        ay: 3,
                        gun: 1,
                        ad: "Ramazan Bayramı 3. Gün"
                    }, {
                        ay: 5,
                        gun: 5,
                        ad: "Kurban Bayramı Arifesi"
                    }, {
                        ay: 5,
                        gun: 6,
                        ad: "Kurban Bayramı 1. Gün"
                    }, {
                        ay: 5,
                        gun: 7,
                        ad: "Kurban Bayramı 2. Gün"
                    }, {
                        ay: 5,
                        gun: 8,
                        ad: "Kurban Bayramı 3. Gün"
                    }, {
                        ay: 5,
                        gun: 9,
                        ad: "Kurban Bayramı 4. Gün"
                    }],
                    "2026": [{
                        ay: 2,
                        gun: 18,
                        ad: "Ramazan Bayramı Arifesi"
                    }, {
                        ay: 2,
                        gun: 19,
                        ad: "Ramazan Bayramı 1. Gün"
                    }, {
                        ay: 2,
                        gun: 20,
                        ad: "Ramazan Bayramı 2. Gün"
                    }, {
                        ay: 2,
                        gun: 21,
                        ad: "Ramazan Bayramı 3. Gün"
                    }, {
                        ay: 4,
                        gun: 25,
                        ad: "Kurban Bayramı Arifesi"
                    }, {
                        ay: 4,
                        gun: 26,
                        ad: "Kurban Bayramı 1. Gün"
                    }, {
                        ay: 4,
                        gun: 27,
                        ad: "Kurban Bayramı 2. Gün"
                    }, {
                        ay: 4,
                        gun: 28,
                        ad: "Kurban Bayramı 3. Gün"
                    }, {
                        ay: 4,
                        gun: 29,
                        ad: "Kurban Bayramı 4. Gün"
                    }],
                    "2027": [{
                        ay: 2,
                        gun: 8,
                        ad: "Ramazan Bayramı Arifesi"
                    }, {
                        ay: 2,
                        gun: 9,
                        ad: "Ramazan Bayramı 1. Gün"
                    }, {
                        ay: 2,
                        gun: 10,
                        ad: "Ramazan Bayramı 2. Gün"
                    }, {
                        ay: 2,
                        gun: 11,
                        ad: "Ramazan Bayramı 3. Gün"
                    }, {
                        ay: 4,
                        gun: 15,
                        ad: "Kurban Bayramı Arifesi"
                    }, {
                        ay: 4,
                        gun: 16,
                        ad: "Kurban Bayramı 1. Gün"
                    }, {
                        ay: 4,
                        gun: 17,
                        ad: "Kurban Bayramı 2. Gün"
                    }, {
                        ay: 4,
                        gun: 18,
                        ad: "Kurban Bayramı 3. Gün"
                    }, {
                        ay: 4,
                        gun: 19,
                        ad: "Kurban Bayramı 4. Gün"
                    }],
                    "2028": [{
                        ay: 1,
                        gun: 27,
                        ad: "Ramazan Bayramı Arifesi"
                    }, {
                        ay: 1,
                        gun: 28,
                        ad: "Ramazan Bayramı 1. Gün"
                    }, {
                        ay: 1,
                        gun: 29,
                        ad: "Ramazan Bayramı 2. Gün"
                    }, {
                        ay: 1,
                        gun: 30,
                        ad: "Ramazan Bayramı 3. Gün"
                    }, {
                        ay: 4,
                        gun: 3,
                        ad: "Kurban Bayramı Arifesi"
                    }, {
                        ay: 4,
                        gun: 4,
                        ad: "Kurban Bayramı 1. Gün"
                    }, {
                        ay: 4,
                        gun: 5,
                        ad: "Kurban Bayramı 2. Gün"
                    }, {
                        ay: 4,
                        gun: 6,
                        ad: "Kurban Bayramı 3. Gün"
                    }, {
                        ay: 4,
                        gun: 7,
                        ad: "Kurban Bayramı 4. Gün"
                    }]
                }
            };
            let tumPersonelListesi = [];

            function formatDateDDMMYYYY(dateString) {
                if (!dateString || typeof dateString !== 'string') return '---';
                const parts = dateString.split('-');
                if (parts.length !== 3) return dateString;
                const [year, month, day] = parts;
                return `${day}.${month}.${year}`;
            }

            function isResmiTatil(date) {
                const year = date.getFullYear();
                const month = date.getMonth();
                const day = date.getDate();
                if (resmiTatiller.sabit.some(t => t.ay === month && t.gun === day)) {
                    return true;
                }
                const yilinTatilleri = resmiTatiller.degisken[year];
                if (yilinTatilleri && yilinTatilleri.some(t => t.ay === month && t.gun === day)) {
                    return true;
                }
                return false;
            }

            function showToast(message, type = 'success') {
                const container = document.getElementById('toast-container');
                const toast = document.createElement('div');
                toast.className = `toast ${type}`;
                toast.textContent = message;
                container.appendChild(toast);
                setTimeout(() => {
                    toast.style.animation = 'slideOut 0.3s forwards';
                    toast.addEventListener('animationend', () => toast.remove());
                }, 3000);
            }
            // YUKARIDAKİ FONKSİYONUN YERİNE BUNU YAPIŞTIRIN

            async function openPersonelDetayModal(personelId) {
                const modal = document.getElementById('personel-detay-modal');
                const title = document.getElementById('personel-detay-modal-title');

                // Konteynerleri seç
                const bilgilerContainer = document.getElementById('personel-bilgileri-container');
                const izinContainer = document.getElementById('personel-izin-gecmisi-container');
                const nobetContainer = document.getElementById('personel-nobet-gecmisi-container');
                const hizmetContainer = document.getElementById('detay-tab-hizmet');
                // YENİ: Görevlendirme konteyneri
                const gorevContainer = document.getElementById('personel-gorev-gecmisi-container');

                // Başlıkları ve içeriği sıfırla
                title.textContent = 'Personel Profili Yükleniyor...';
                bilgilerContainer.innerHTML = '<p>Kişisel bilgiler yükleniyor...</p>';
                izinContainer.innerHTML = '<p style="padding: 20px;">İzin geçmişi yükleniyor...</p>';
                nobetContainer.innerHTML = '<p style="padding: 20px;">Nöbet geçmişi yükleniyor...</p>';
                hizmetContainer.innerHTML = '<p style="padding: 20px;">Hizmet geçmişi yükleniyor...</p>';
                // YENİ: Görevlendirme içeriğini sıfırla
                if (gorevContainer) {
                    gorevContainer.innerHTML = '<p style="padding: 20px;">Görevlendirme geçmişi yükleniyor...</p>';
                }

                modal.classList.add('open');
                showSpinner();

                try {
                    // YENİ: 'gorevlendirmeSnap' sorgusu eklendi
                    const [
                        personelDoc, izinSnap, nobetSnap, izinTipiSnap, nobetYeriSnap,
                        neviSnap, gorevSnap, hizmetGecmisiSnap, gorevlendirmeSnap
                    ] = await Promise.all([
                        getDoc(doc(db, 'personel', personelId)),
                        getDocs(query(collection(db, 'izinler'), where('personelId', '==', personelId), where("okulId", "==", currentUserOkulId), orderBy('baslangicTarihi', 'desc'))),
                        getDocs(query(collection(db, 'nobetler'), where('personelId', '==', personelId), where("okulId", "==", currentUserOkulId), orderBy('tarih', 'desc'))),
                        getSettings('ayarlar_izin_tipleri'),
                        getSettings('ayarlar_nobet_yerleri'),
                        getSettings('ayarlar_personel_nevileri'),
                        getSettings('ayarlar_gorevler'),
                        getDocs(query(collection(db, 'personel', personelId, 'hizmetGecmisi'), orderBy('baslangicTarihi', 'desc'))),
                        // YENİ SORGU: Bu personelin dahil olduğu tüm görevlendirmeler
                        getDocs(query(collection(db, 'ders_gorevlendirmeleri'), where("okulId", "==", currentUserOkulId), where('gorevliIdListesi', 'array-contains', personelId), orderBy('tarih', 'desc')))
                    ]);

                    if (!personelDoc.exists()) {
                        throw new Error('Personel bulunamadı!');
                    }

                    const personel = personelDoc.data();
                    title.textContent = `${personel.ad_soyad} - Personel Profili`;

                    // Haritaları oluştur (Personel haritası dahil)
                    const izinTipiDataMap = new Map(izinTipiSnap.docs.map(d => [d.id, d.data()]));
                    const nobetYeriMap = new Map(nobetYeriSnap.docs.map(d => [d.id, d.data().name]));
                    const neviMap = new Map(neviSnap.docs.map(d => [d.id, d.data().name]));
                    const gorevMap = new Map(gorevSnap.docs.map(d => [d.id, d.data().name]));
                    // YENİ: Diğer personellerin isimleri için bir harita
                    const allPersonelSnap = await getDocs(query(collection(db, 'personel'), where("okulId", "==", currentUserOkulId)));
                    const personelMap = new Map(allPersonelSnap.docs.map(d => [d.id, d.data().ad_soyad]));

                    // ... (Mevcut render işlemleri: bilgiler, izinler, nöbetler, hizmet) ...
                    // (Aşağıdaki kod blokları, dosyanızda zaten var olan kodlardır, değişiklik yok)

                    // Kişisel Bilgiler
                    const kismiCalismaHTML = personel.kismi_zamanli_calisma ? Object.entries(personel.kismi_zamanli_calisma)
                        .map(([gun, saat]) => `<span>${gun}: ${saat} saat</span>`).join('') : 'Yok';
                    bilgilerContainer.innerHTML = `
                        <div class="info-grid">
                            <div class="info-item"><label>Ad Soyad</label><span>${personel.ad_soyad || '---'}</span></div>
                            <div class="info-item"><label>T.C. Kimlik No</label><span>${personel.tc_kimlik_no || '---'}</span></div>
                            <div class="info-item"><label>SGK No</label><span>${personel.sgk_no || '---'}</span></div>
                            <div class="info-item"><label>Personel Nevisi</label><span>${neviMap.get(personel.personel_nevisi) || '---'}</span></div>
                            <div class="info-item"><label>Görevi / Branşı</label><span>${gorevMap.get(personel.gorevi_bransi) || '---'}</span></div>
                            <div class="info-item"><label>Sözleşme Türü</label><span>${personel.sozlesme_turu || '---'}</span></div>
                            <div class="info-item"><label>İşe Giriş Tarihi</label><span>${formatDateDDMMYYYY(personel.ise_giris)}</span></div>
                            <div class="info-item"><label>İşten Ayrılış Tarihi</label><span>${formatDateDDMMYYYY(personel.isten_ayrilis) || 'Devam Ediyor'}</span></div>
                            <div class="info-item"><label>Cinsiyet</label><span>${personel.cinsiyet === 'kadin' ? 'Kadın' : 'Erkek'}</span></div>
                            <div class="info-item"><label>Eş Durumu</label><span>${personel.es_durumu || '---'}</span></div>
                            <div class="info-item"><label>Çocuk Sayısı (0-6 Yaş)</label><span>${personel.cocuk_0_6 || '0'}</span></div>
                            <div class="info-item"><label>Çocuk Sayısı (6-18 Yaş)</label><span>${personel.cocuk_6_ustu || '0'}</span></div>
                            <div class="info-item full-width"><label>Açıklama</label><span>${personel.aciklama || 'Yok'}</span></div>
                            ${personel.sozlesme_turu === 'Kısmi Süreli' ? `
                            <div class="info-item full-width"><label>Kısmi Çalışma Saatleri</label><div class="card-list" style="max-height: 80px;">${kismiCalismaHTML}</div></div>` : ''}
                        </div>`;

                    // İzin Geçmişi
                    if (izinSnap.empty) {
                        izinContainer.innerHTML = '<p style="padding: 20px; text-align: center;">Bu personele ait izin kaydı bulunmamaktadır.</p>';
                    } else {
                        let izinTableHTML = '<table class="gorevlendirme-table"><thead><tr><th>İzin Tipi</th><th>Başlangıç</th><th>Bitiş</th><th>Süre</th><th>Açıklama</th></tr></thead><tbody>';
                        izinSnap.forEach(doc => {
                            const izin = doc.data();
                            const izinTipiVerisi = izinTipiDataMap.get(izin.izinTipiId) || { name: 'Bilinmiyor', kod: '' };
                            const sure = calculateNetIzinSuresi(izin.baslangicTarihi, izin.bitisTarihi, personel, izinTipiVerisi.kod);
                            const sureEtiketi = (izinTipiVerisi.kod === 'R' || izinTipiVerisi.kod === 'Üİ') ? 'gün' : 'iş günü';
                            izinTableHTML += `
                                <tr>
                                    <td>${izinTipiVerisi.name}</td>
                                    <td>${formatDateDDMMYYYY(izin.baslangicTarihi)}</td>
                                    <td>${formatDateDDMMYYYY(izin.bitisTarihi)}</td>
                                    <td>${sure} ${sureEtiketi}</td>
                                    <td>${izin.aciklama || '---'}</td>
                                </tr>`;
                        });
                        izinContainer.innerHTML = izinTableHTML + '</tbody></table>';
                    }

                    // Nöbet Geçmişi
                    if (nobetSnap.empty) {
                        nobetContainer.innerHTML = '<p style="padding: 20px; text-align: center;">Bu personele ait nöbet kaydı bulunmamaktadır.</p>';
                    } else {
                        const gunlerTR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
                        let nobetTableHTML = '<table class="gorevlendirme-table"><thead><tr><th>Tarih</th><th>Gün</th><th>Nöbet Yeri</th></tr></thead><tbody>';
                        nobetSnap.forEach(doc => {
                            const nobet = doc.data();
                            const tarih = new Date(nobet.tarih + 'T00:00:00Z');
                            nobetTableHTML += `
                                <tr>
                                    <td>${formatDateDDMMYYYY(nobet.tarih)}</td>
                                    <td>${gunlerTR[tarih.getUTCDay()]}</td>
                                    <td>${nobetYeriMap.get(nobet.nobetYeriId) || 'Bilinmiyor'}</td>
                                </tr>`;
                        });
                        nobetContainer.innerHTML = nobetTableHTML + '</tbody></table>';
                    }

                    // Hizmet Geçmişi
                    if (hizmetGecmisiSnap.empty) {
                        hizmetContainer.innerHTML = '<p style="padding: 20px; text-align: center;">Bu personele ait hizmet geçmişi kaydı bulunmamaktadır.</p>';
                    } else {
                        let hizmetTableHTML = '<div class="table-container" style="margin-top: 20px;"><table class="gorevlendirme-table"><thead><tr><th>Görev / Unvan</th><th>Sözleşme Türü</th><th>Başlangıç Tarihi</th><th>Bitiş Tarihi</th></tr></thead><tbody>';
                        hizmetGecmisiSnap.forEach(doc => {
                            const kayit = doc.data();
                            const gorevAdi = gorevMap.get(kayit.gorevId) || 'Bilinmiyor';
                            const bitisTarihi = kayit.bitisTarihi ? formatDateDDMMYYYY(kayit.bitisTarihi) : '<strong>Devam Ediyor</strong>';
                            hizmetTableHTML += `
                                <tr>
                                    <td>${gorevAdi}</td>
                                    <td>${kayit.sozlesmeTuru || '---'}</td>
                                    <td>${formatDateDDMMYYYY(kayit.baslangicTarihi)}</td>
                                    <td>${bitisTarihi}</td>
                                </tr>`;
                        });
                        hizmetContainer.innerHTML = hizmetTableHTML + '</tbody></table></div>';
                    }

                    // YENİ: Görevlendirme Geçmişi
                    renderPersonelGorevlendirmeGecmisi(gorevlendirmeSnap, personelId, personelMap);

                } catch (error) {
                    console.error("Personel detayları yüklenirken hata:", error);
                    title.textContent = 'Hata!';
                    bilgilerContainer.innerHTML = `<p style="color:red;">Personel bilgileri yüklenemedi: ${error.message}</p>`;
                    izinContainer.innerHTML = `<p style="color:red; padding: 20px;">İzin geçmişi yüklenemedi: ${error.message}</p>`;
                    nobetContainer.innerHTML = `<p style="color:red; padding: 20px;">Nöbet geçmişi yüklenemedi: ${error.message}</p>`;
                    hizmetContainer.innerHTML = `<p style="color:red; padding: 20px;">Hizmet geçmişi yüklenemedi: ${error.message}</p>`;
                    if (gorevContainer) {
                        gorevContainer.innerHTML = `<p style="color:red; padding: 20px;">Görevlendirme geçmişi yüklenemedi: ${error.message}</p>`;
                    }
                } finally {
                    hideSpinner();
                }
            }

            function safeSetContent(id, content, isHtml = false) {
                const el = document.getElementById(id);
                if (el) {
                    el[isHtml ? 'innerHTML' : 'textContent'] = content;
                }
            }

            function initializeDashboardFilters() {
                const selectMonth = document.getElementById('dashboard-select-month');
                const inputYear = document.getElementById('dashboard-input-year');
                if (!selectMonth || !inputYear || selectMonth.dataset.initialized) {
                    return;
                }

                const now = new Date();
                const months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
                selectMonth.innerHTML = '';
                months.forEach((m, i) => selectMonth.add(new Option(m, i)));
                selectMonth.value = now.getMonth();
                inputYear.value = now.getFullYear();
                const reloadDashboard = () => renderDashboardData();
                selectMonth.addEventListener('change', reloadDashboard);
                inputYear.addEventListener('change', reloadDashboard);
                selectMonth.dataset.initialized = 'true';
            }
            async function renderDashboardData() {
                initializeDashboardFilters();

                if (isCurrentUserSuperAdmin && !currentUserOkulId) {
                    const dashboardGrid = document.querySelector('#dashboard .dashboard-grid');
                    if (dashboardGrid) {
                        dashboardGrid.innerHTML = `
        <div class="panel" style="grid-column: 1 / -1; padding: 40px; text-align: center;">
            <h3 style="color: var(--theme-primary);">Süper Admin Paneline Hoş Geldiniz</h3>
            <p style="font-size: 1.1em; margin-top: 15px;">
                Bir okulun verilerini görüntülemek için lütfen sol üstteki menüden <strong>bir okul seçin</strong>.
            </p>
        </div>`;
                    }
                    safeSetContent('db-aylik-ekders', '-');
                    safeSetContent('db-aylik-nobet', '-');
                    safeSetContent('db-aylik-rehberlik', '-');
                    safeSetContent('db-aylik-raporlular-list', '<span class="no-data">Okul seçilmedi.</span>', true);
                    return;
                }

                showSpinner();
                safeSetContent('db-aktif-personel', '...');
                safeSetContent('db-gunun-nobetcileri-list', 'Yükleniyor...', true);
                safeSetContent('db-bugun-izinliler-list', 'Yükleniyor...', true);
                safeSetContent('db-bugun-gorevli-list', 'Yükleniyor...', true);
                safeSetContent('db-aylik-ekders', '...');
                safeSetContent('db-aylik-nobet', '...');
                safeSetContent('db-aylik-rehberlik', '...');
                safeSetContent('db-aylik-raporlular-list', 'Yükleniyor...', true);

                try {
                    if (!currentUserOkulId) {
                        throw new Error("Kullanıcı okul kimliği bulunamadı. Oturum başlatılamadı.");
                    }
                    const today = new Date();
                    const todayString = today.toISOString().split('T')[0];
                    const selectedMonth = parseInt(document.getElementById('dashboard-select-month').value);
                    const selectedYear = parseInt(document.getElementById('dashboard-input-year').value);
                    const puantajDocId = `${currentUserOkulId}_${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;

                    const [
                        personelSnap, nobetSnap, izinSnap, gorevSnap, nobetYeriSnap,
                        izinTipiSnap, puantajDocSnap
                    ] = await Promise.all([
                        getDocs(query(collection(db, "personel"), where("okulId", "==", currentUserOkulId))),
                        getDocs(query(collection(db, "nobetler"), where("okulId", "==", currentUserOkulId), where("tarih", "==", todayString))),
                        getDocs(query(collection(db, "izinler"), where("okulId", "==", currentUserOkulId), where("baslangicTarihi", "<=", todayString))),
                        getDocs(query(collection(db, "ders_gorevlendirmeleri"), where("okulId", "==", currentUserOkulId), where("tarih", "==", todayString))),
                        getSettings('ayarlar_nobet_yerleri'),
                        getSettings('ayarlar_izin_tipleri'),
                        getDoc(doc(db, "kayitli_puantajlar", puantajDocId))
                    ]);

                    const personelMap = new Map(personelSnap.docs.map(doc => [doc.id, doc.data().ad_soyad]));
                    const nobetYeriMap = new Map(nobetYeriSnap.docs.map(doc => [doc.id, doc.data().name]));
                    const bugunTarihi = new Date();
                    bugunTarihi.setHours(0, 0, 0, 0);
                    const aktifPersonelListesi = personelSnap.docs.filter(doc => !doc.data().isten_ayrilis || new Date(doc.data().isten_ayrilis) > bugunTarihi);
                    safeSetContent('db-aktif-personel', aktifPersonelListesi.length);
                    const nobetHtml = nobetSnap.empty ? '<span class="no-data">Bugün nöbetçi yok.</span>' : nobetSnap.docs.map(doc => `<span><strong>${personelMap.get(doc.data().personelId) || '?'}</strong> - ${nobetYeriMap.get(doc.data().nobetYeriId) || ''}</span>`).join('');
                    safeSetContent('db-gunun-nobetcileri-list', nobetHtml, true);
                    const bugunIzinliler = izinSnap.docs.filter(doc => new Date(doc.data().bitisTarihi + 'T23:59:59') >= today).map(doc => personelMap.get(doc.data().personelId) || '?');
                    const izinHtml = bugunIzinliler.length === 0 ? '<span class="no-data">Bugün izinli personel yok.</span>' : bugunIzinliler.map(ad => `<span>${ad}</span>`).join('');
                    safeSetContent('db-bugun-izinliler-list', izinHtml, true);
                    const gorevHtml = gorevSnap.empty ? '<span class="no-data">Bugün görevlendirme yok.</span>' : gorevSnap.docs.map(d => `<span><strong>${personelMap.get(d.data().gorevliId) || '?'}</strong> (Yerine: ${personelMap.get(d.data().asilId) || '?'})</span>`).join('');
                    safeSetContent('db-bugun-gorevli-list', gorevHtml, true);
                    const educationPeriods = await fetchEducationPeriods();
                    let totalEkders = 0, totalNobet = 0, totalRehberlik = 0;
                    const aylikPuantajVerisi = puantajDocSnap.exists() ? puantajDocSnap.data().puantajData : null;

                    if (aylikPuantajVerisi) {
                        window.puantajData = aylikPuantajVerisi;
                        const personelPeriods = await getPersonelPeriodsForMonth(selectedYear, selectedMonth);
                        const nobetVerisi = await fetchAndCalculateNobetData(selectedYear, selectedMonth);
                        const islenmisPersonelIdleri = new Set();
                        for (const period of personelPeriods) {
                            const uniqueId = period.uniquePeriodId;
                            const personelId = period.id;
                            if (aylikPuantajVerisi[uniqueId]) {
                                const monthlyHours = await calculateMonthlyHours(uniqueId);
                                totalEkders += (monthlyHours.ekDers || 0);
                                if (aylikPuantajVerisi[uniqueId].sozlesme_turu === 'Belirsiz Süreli') {
                                    totalEkders += (calculateFazlaMesai(uniqueId) || 0);
                                }

                                totalRehberlik += calculateEffectiveRehberlikHours(uniqueId, selectedYear, selectedMonth, aylikPuantajVerisi, educationPeriods);
                                if (!islenmisPersonelIdleri.has(personelId)) {
                                    totalNobet += (nobetVerisi[personelId] || 0);
                                    islenmisPersonelIdleri.add(personelId);
                                }
                            }
                        }
                    }

                    safeSetContent('db-aylik-ekders', totalEkders);
                    safeSetContent('db-aylik-nobet', totalNobet);
                    safeSetContent('db-aylik-rehberlik', totalRehberlik);
                    const raporluIzinTipi = izinTipiSnap.docs.find(doc => doc.data().kod === 'R');
                    let raporluHtml = '<span class="no-data">Rapor tanımı bulunamadı.</span>';
                    if (raporluIzinTipi) {
                        const raporluPersonelListesi = new Set();
                        const raporSorgusu = query(collection(db, "izinler"), where("okulId", "==", currentUserOkulId), where("izinTipiId", "==", raporluIzinTipi.id));
                        const raporluIzinlerSnap = await getDocs(raporSorgusu);
                        const ayinIlkGunu = new Date(selectedYear, selectedMonth, 1);
                        const ayinSonGunu = new Date(selectedYear, selectedMonth + 1, 0);
                        raporluIzinlerSnap.forEach(doc => {
                            const izin = doc.data();
                            if (new Date(izin.baslangicTarihi + 'T00:00:00') <= ayinSonGunu && new Date(izin.bitisTarihi + 'T23:59:59') >= ayinIlkGunu) {
                                const personelAdi = personelMap.get(izin.personelId);
                                if (personelAdi) raporluPersonelListesi.add(personelAdi);
                            }
                        });
                        raporluHtml = raporluPersonelListesi.size === 0 ? '<span class="no-data">Bu ay raporlu personel yok.</span>' : Array.from(raporluPersonelListesi).map(ad => `<span>${ad}</span>`).join('');
                    }
                    safeSetContent('db-aylik-raporlular-list', raporluHtml, true);

                } catch (error) {
                    console.error("Dashboard verisi çekilirken hata:", error);
                    safeSetContent('db-aktif-personel', 'Hata!');
                } finally {
                    hideSpinner();
                }
            }
            const getSettings = async (collectionName) => getDocs(query(collection(db, collectionName), where("okulId", "==", currentUserOkulId), orderBy("name")));
            const addSetting = (collectionName, data) => {
                const dataWithSchoolId = {
                    ...data,
                    okulId: currentUserOkulId
                };
                return addDoc(collection(db, collectionName), dataWithSchoolId);
            };
            const deleteSetting = (collectionName, id) => deleteDoc(doc(db, collectionName, id));


            async function renderSettingsList(collectionName, listElementId, relatedData) {
                const listElement = document.getElementById(listElementId);
                if (!listElement) return;
                listElement.innerHTML = '<li>Yükleniyor...</li>';
                try {
                    const snapshot = await getSettings(collectionName);
                    if (snapshot.empty) {
                        listElement.innerHTML = '<li>Henüz veri eklenmemiş.</li>';
                        return;
                    }
                    listElement.innerHTML = '';
                    snapshot.forEach(doc => {
                        const item = doc.data();
                        const li = document.createElement('li');
                        let displayText = item.name;

                        if (collectionName === 'ayarlar_gorevler' && relatedData) {
                            const nevi = relatedData.find(n => n.id === item.neviId);
                            displayText = `${item.name} <small style="color: #555;">(${nevi ? nevi.name : 'Bilinmeyen'})</small>`;
                        }
                        if (collectionName === 'ayarlar_izin_tipleri') {
                            displayText = `${item.name} <strong style="color: var(--theme-accent);"> (Kod: ${item.kod})</strong>`;
                        }

                        if (collectionName === 'ayarlar_dersler') {
                            displayText = `${item.name} <strong style="color: var(--theme-accent);">(${item.kisaltma || '---'})</strong>`;
                        }
                        const kisaltmaDataAttribute = (collectionName === 'ayarlar_dersler') ? `data-kisaltma="${item.kisaltma || ''}"` : '';
                        li.innerHTML = `
                            <span>${displayText}</span>
                            <div class="actions-cell" style="width: auto; min-width: 120px;">
                                <button class="btn btn-edit btn-edit-setting" data-id="${doc.id}" data-collection="${collectionName}" data-name="${item.name}" ${kisaltmaDataAttribute}>Düzenle</button>
                                <button class="btn btn-delete btn-delete-setting" data-id="${doc.id}" data-collection="${collectionName}" data-name="${item.name}">Sil</button>
                            </div>
                        `;

                        listElement.appendChild(li);
                    });
                } catch (e) {
                    listElement.innerHTML = '<li>Veri yüklenemedi.</li>';
                    console.error("Error rendering settings:", e);
                }
            }

            function openSettingEditModal(id, collectionName, currentName, currentKisaltma = '') {
                const modal = document.getElementById('edit-setting-modal');
                const title = document.getElementById('edit-setting-modal-title');
                const nameInput = document.getElementById('edit-setting-input');
                const kisaltmaGroup = document.getElementById('edit-kisaltma-group');
                const kisaltmaInput = document.getElementById('edit-setting-kisaltma-input');
                const saveBtn = document.getElementById('edit-setting-save-btn');

                title.textContent = `"${currentName}" Adlı Ayarı Düzenle`;
                nameInput.value = currentName;
                saveBtn.dataset.id = id;
                saveBtn.dataset.collection = collectionName;


                if (collectionName === 'ayarlar_dersler') {
                    kisaltmaInput.value = currentKisaltma || '';
                    kisaltmaGroup.style.display = 'block';
                } else {
                    kisaltmaGroup.style.display = 'none';
                }

                modal.classList.add('open');
            }


            document.getElementById('edit-setting-save-btn').addEventListener('click', async () => {
                const saveBtn = document.getElementById('edit-setting-save-btn');
                const id = saveBtn.dataset.id;
                const collectionName = saveBtn.dataset.collection;
                const newName = document.getElementById('edit-setting-input').value.trim();
                const kisaltmaInput = document.getElementById('edit-setting-kisaltma-input');
                const newKisaltma = kisaltmaInput.value.trim().toUpperCase();

                if (!newName) {
                    return showToast('Ayar adı boş bırakılamaz.', 'error');
                }

                const dataToUpdate = { name: newName };

                if (collectionName === 'ayarlar_dersler') {
                    if (!newKisaltma) { return showToast('Kısaltma alanı boş bırakılamaz.', 'error'); }
                    if (newKisaltma.length > 3) { return showToast('Kısaltma en fazla 3 harf olmalıdır.', 'error'); }
                    dataToUpdate.kisaltma = newKisaltma;
                }

                try {
                    const docRef = doc(db, collectionName, id);
                    await setDoc(docRef, dataToUpdate, { merge: true });

                    showToast('Ayar başarıyla güncellendi.');
                    document.getElementById('edit-setting-modal').classList.remove('open');
                    switch (collectionName) {
                        case 'ayarlar_personel_nevileri':
                            await renderSettingsList(collectionName, 'nevi-list');
                            break;
                        case 'ayarlar_gorevler':
                            const neviSnapshot = await getSettings('ayarlar_personel_nevileri');
                            const personelNevileri = neviSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
                            await renderSettingsList(collectionName, 'gorev-list', personelNevileri);
                            break;
                        case 'ayarlar_izin_tipleri':
                            await renderSettingsList(collectionName, 'izin-tipi-list');
                            break;
                        case 'ayarlar_nobet_yerleri':
                            await renderSettingsList(collectionName, 'nobet-yeri-list');
                            break;
                        case 'ayarlar_dersler':
                            await renderSettingsList(collectionName, 'ders-list');
                            break;
                        case 'ayarlar_siniflar':
                            await renderSettingsList(collectionName, 'sinif-list');
                            break;
                        case 'ayarlar_derslikler':
                            await renderSettingsList(collectionName, 'derslik-listesi');
                            break;
                    }

                } catch (error) {
                    console.error("Ayar güncellenirken hata:", error);
                    showToast('Güncelleme sırasında bir hata oluştu.', 'error');
                }
            });

            async function saveGenelKurallar(data) {

                const dataToSave = {
                    ...data,
                    okulId: currentUserOkulId
                };
                await setDoc(doc(db, "programlama_kurallari", currentUserOkulId), dataToSave, {
                    merge: true
                });
            }


            async function loadGenelKurallar() {
                try {
                    await loadZamanCizelgesiAyarlari();
                    await generateTimeSlots();
                    const docRef = doc(db, "programlama_kurallari", currentUserOkulId);
                    const docSnap = await getDoc(docRef);
                    const derslerSnap = await getSettings('ayarlar_dersler');
                    const dersMap = new Map(derslerSnap.docs.map(doc => [doc.id, doc.data().name]));
                    const zorDerslerSelect = document.getElementById('kural-zor-dersler-sec');
                    if (zorDerslerSelect) {
                        zorDerslerSelect.innerHTML = '';
                        derslerSnap.forEach(doc => {
                            zorDerslerSelect.add(new Option(doc.data().name, doc.id));
                        });
                    }
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        renderBlokeZamanListesi(data.blokeZamanlar || []);
                        renderZorDersKurali(data.zorDersler, data.maxZorDersSayisi, dersMap);
                    } else {
                        renderBlokeZamanListesi([]);
                        renderZorDersKurali(null, null, dersMap);
                    }
                } catch (e) {
                    console.error("Genel kurallar yüklenemedi:", e);
                }
            }

            function renderBlokeZamanListesi(blokeZamanlar) {
                const listEl = document.getElementById('genel-bloke-listesi');
                if (!listEl) return;
                if (!blokeZamanlar || blokeZamanlar.length === 0) {
                    listEl.innerHTML = '<li style="justify-content: center; color: #777;">Henüz bloke edilmiş bir zaman dilimi yok.</li>';
                    return;
                }
                listEl.innerHTML = '';
                blokeZamanlar.forEach((zaman, index) => {
                    const li = document.createElement('li');
                    li.id = `bloke-item-${index}`;
                    li.innerHTML = `
            <span><strong>${zaman.gun}</strong> - ${zaman.saat}. Ders</span>
            <div class="actions-cell" style="width: auto; min-width: 150px;">
                <button class="btn btn-edit btn-edit-bloke" data-index="${index}">Düzenle</button>
                <button class="btn btn-delete btn-delete-bloke" data-index="${index}">Sil</button>
            </div>
        `;
                    listEl.appendChild(li);
                });


                listEl.onclick = async (e) => {
                    const target = e.target;
                    const index = parseInt(target.dataset.index);


                    if (target.classList.contains('btn-delete-bloke')) {
                        showConfirmationModal(`<strong>${blokeZamanlar[index].gun} - ${blokeZamanlar[index].saat}. Ders</strong> blokesini kaldırmak istediğinizden emin misiniz?`, async () => {
                            blokeZamanlar.splice(index, 1);
                            await saveGenelKurallar({ blokeZamanlar });
                            renderBlokeZamanListesi(blokeZamanlar); // Listeyi yenile
                            showToast('Bloke zaman kaldırıldı.');
                        });
                    }


                    if (target.classList.contains('btn-edit-bloke')) {
                        const li = document.getElementById(`bloke-item-${index}`);
                        const zaman = blokeZamanlar[index];


                        let saatOptionsHTML = '';
                        dersSaatleri.forEach(slot => {
                            const selected = slot.dersNo == zaman.saat ? 'selected' : '';
                            saatOptionsHTML += `<option value="${slot.dersNo}" ${selected}>${slot.dersNo}. Ders</option>`;
                        });


                        const gunler = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
                        let gunOptionsHTML = '';
                        gunler.forEach(gun => {
                            const selected = gun === zaman.gun ? 'selected' : '';
                            gunOptionsHTML += `<option value="${gun}" ${selected}>${gun}</option>`;
                        });


                        li.innerHTML = `
                <div style="display: flex; gap: 10px; align-items: center; width: 100%;">
                    <select id="edit-gun-${index}" style="flex:2;">${gunOptionsHTML}</select>
                    <select id="edit-saat-${index}" style="flex:1;">${saatOptionsHTML}</select>
                </div>
                <div class="actions-cell" style="width: auto; min-width: 150px;">
                    <button class="btn btn-save btn-save-bloke" data-index="${index}">Kaydet</button>
                    <button class="btn btn-cancel-bloke" data-index="${index}" style="background-color: #6c757d;">İptal</button>
                </div>
            `;
                    }


                    if (target.classList.contains('btn-save-bloke')) {
                        const newGun = document.getElementById(`edit-gun-${index}`).value;
                        const newSaat = document.getElementById(`edit-saat-${index}`).value;

                        blokeZamanlar[index] = { gun: newGun, saat: newSaat };
                        await saveGenelKurallar({ blokeZamanlar });
                        renderBlokeZamanListesi(blokeZamanlar);
                        showToast('Değişiklikler kaydedildi.');
                    }


                    if (target.classList.contains('btn-cancel-bloke')) {
                        renderBlokeZamanListesi(blokeZamanlar);
                    }
                };
            }

            async function loadAndRenderDersKurallari() {
                const tbody = document.getElementById('ders-kural-tbody');
                tbody.innerHTML = '<tr><td colspan="6">Yükleniyor...</td></tr>';

                try {
                    const [derslerSnap, personelSnap, dersKurallariSnap] = await Promise.all([
                        getSettings('ayarlar_dersler'),
                        getDocs(query(collection(db, 'personel'), where("okulId", "==", currentUserOkulId))),
                        getDocs(query(collection(db, "ders_kurallari"), where("okulId", "==", currentUserOkulId)))
                    ]);
                    const dersMap = new Map(derslerSnap.docs.map(doc => [doc.id, doc.data().name]));
                    const personelMap = new Map(personelSnap.docs.map(doc => [doc.id, doc.data().ad_soyad]));
                    const tumKurallar = dersKurallariSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    document.getElementById('ders-kural-filters').style.display = 'grid';
                    const dersFilterId = document.getElementById('kural-filter-ders-select').value;
                    const sinifFilterName = document.getElementById('kural-table-filter-sinif-select').value;
                    const ogretmenFilterId = document.getElementById('kural-filter-ogretmen-select').value;
                    const filtrelenmisKurallar = tumKurallar.filter(kural => {
                        const dersMatch = !dersFilterId || kural.dersId === dersFilterId;
                        const sinifMatch = !sinifFilterName || kural.seviye === sinifFilterName;
                        const ogretmenMatch = !ogretmenFilterId || kural.atananOgretmenId === ogretmenFilterId;
                        return dersMatch && sinifMatch && ogretmenMatch;
                    });
                    tbody.innerHTML = '';
                    let toplamHaftalikSaat = 0;
                    if (filtrelenmisKurallar.length === 0) {
                        tbody.innerHTML = '<tr><td colspan="6">Bu filtrelere uygun kural bulunamadı.</td></tr>';
                    } else {
                        filtrelenmisKurallar.sort((a, b) => (dersMap.get(a.dersId) || '').localeCompare(dersMap.get(b.dersId) || '') || a.seviye.localeCompare(b.seviye)).forEach(kural => {
                            const dersAdi = dersMap.get(kural.dersId) || 'Bilinmeyen Ders';
                            const ogretmenAdi = personelMap.get(kural.atananOgretmenId) || '<span style="color:#888;">Atanmamış</span>';
                            const haftalikSaat = parseInt(kural.haftalikSaat) || 0;
                            toplamHaftalikSaat += haftalikSaat;

                            const row = tbody.insertRow();
                            row.innerHTML = `
                    <td>${dersAdi}</td>
                    <td>${kural.seviye}</td>
                    <td>${ogretmenAdi}</td>
                    <td>${haftalikSaat}</td>
                    <td>${kural.gunlukMaxSaat || '-'}</td>
                    <td class="actions-cell" style="width: auto; min-width: 150px;">
                        <button class="btn btn-edit btn-edit-ders-kurali" data-id="${kural.id}" data-kural='${JSON.stringify(kural)}'>Düzenle</button>
                        <button class="btn btn-delete btn-delete-setting" data-collection="ders_kurallari" data-id="${kural.id}" data-name="${dersAdi} (${kural.seviye})">Sil</button>
                    </td>
                `;
                        });
                    }

                    const tfoot = document.getElementById('ders-kural-tfoot');
                    tfoot.innerHTML = `
            <tr>
                <td colspan="3" style="text-align: right;">Filtrelenmiş Toplam Haftalık Ders Saati:</td>
                <td>${toplamHaftalikSaat}</td>
                <td colspan="2"></td>
            </tr>
        `;

                } catch (e) {
                    tbody.innerHTML = `<tr><td colspan="6" style="color:red;">Hata: Kurallar yüklenemedi. ${e.message}</td></tr>`;
                    console.error("Ders kuralları yüklenirken hata:", e);
                }
            }

            function createVisualScheduler() {
                const table = document.getElementById('ogretmen-kural-tablosu');
                if (!table) return;
                table.innerHTML = '';
                const gunler = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
                let thead = '<thead><tr><th>Saatler</th>';
                gunler.forEach(gun => thead += `<th>${gun}</th>`);
                thead += '</tr></thead>';
                table.innerHTML = thead;
                let tbody = '<tbody>';
                dersSaatleri.forEach(slot => {
                    tbody += `<tr><th>${slot.dersNo}. Ders<br><small>${slot.baslangic}-${slot.bitis}</small></th>`;
                    gunler.forEach(gun => {
                        tbody += `<td id="cell-${gun}-${slot.dersNo}" data-status="musait" class="status-musait"></td>`;
                    });
                    tbody += '</tr>';
                });
                tbody += '</tbody>';
                table.innerHTML += tbody;
                table.addEventListener('click', (e) => {
                    if (e.target.tagName === 'TD') {
                        const cell = e.target;
                        const currentStatus = cell.dataset.status;
                        let nextStatus = '';
                        let nextText = '';
                        switch (currentStatus) {
                            case 'musait':
                                nextStatus = 'tercihen-bos';
                                nextText = 'Tercihen Boş';
                                break;
                            case 'tercihen-bos':
                                nextStatus = 'kesinlikle-bos';
                                nextText = 'Kesinlikle Boş';
                                break;
                            case 'kesinlikle-bos':
                                nextStatus = 'musait';
                                nextText = '';
                                break;
                            default:
                                nextStatus = 'musait';
                                nextText = '';
                        }
                        cell.dataset.status = nextStatus;
                        cell.className = `status-${nextStatus}`;
                        cell.textContent = nextText;
                    }
                });
            }
            async function loadOgretmenKurallari(ogretmenId) {
                const form = document.getElementById('ogretmen-kural-formu');
                form.style.display = 'none';
                if (!ogretmenId) return;
                try {
                    const docRef = doc(db, "ogretmen_kurallari", ogretmenId);
                    const docSnap = await getDoc(docRef);
                    const data = docSnap.exists() ? docSnap.data() : {};
                    const zamanPlanlari = data.zamanPlanlari || {};
                    document.querySelectorAll('#ogretmen-kural-tablosu td').forEach(cell => {
                        const status = zamanPlanlari[cell.id] || 'musait';
                        let text = '';
                        if (status === 'tercihen-bos') text = 'Tercihen Boş';
                        else if (status === 'kesinlikle-bos') text = 'Kesinlikle Boş';
                        cell.dataset.status = status;
                        cell.className = `status-${status}`;
                        cell.textContent = text;
                    });
                    document.getElementById('ogretmen-max-gunluk-ders').value = data.maxGunlukDers || '';
                    document.getElementById('ogretmen-max-ardisik-ders').value = data.maxArdisikDers || '';
                    document.getElementById('ogretmen-gunluk-denge').value = data.gunlukDenge || '';
                    document.getElementById('ogretmen-max-bosluk').value = data.maxBosluk || '';
                    form.style.display = 'block';
                } catch (e) {
                    console.error("Öğretmen kuralları yüklenemedi:", e);
                    showToast("Öğretmen kuralları yüklenemedi.", "error");
                }
            }


            function renderZorDersKurali(zorDersler, maxSayi, dersMap) {
                const formContainer = document.getElementById('zor-ders-form-container');
                const gostergeContainer = document.getElementById('zor-ders-kural-gosterge');
                const zorDerslerSelect = document.getElementById('kural-zor-dersler-sec');
                const maxDersInput = document.getElementById('kural-gunluk-max-zor-ders');
                if (zorDersler && zorDersler.length > 0 && maxSayi) {
                    formContainer.style.display = 'none';
                    gostergeContainer.style.display = 'block';
                    Array.from(zorDerslerSelect.options).forEach(opt => {
                        opt.selected = zorDersler.includes(opt.value);
                    });
                    maxDersInput.value = maxSayi;
                    let derslerHTML = '';
                    zorDersler.forEach(dersId => {
                        derslerHTML += `<li>${dersMap.get(dersId) || 'Bilinmeyen Ders'}</li>`;
                    });
                    gostergeContainer.innerHTML = `
            <ul class="settings-list">
                <li>
                    <div style="flex-grow: 1;">
                        <p style="margin:0 0 5px 0;"><strong>Zorlayıcı olarak seçilen dersler:</strong></p>
                        <ul style="margin: 0; padding-left: 20px; list-style-type: square;">${derslerHTML}</ul>
                        <p style="margin-top: 10px;">Bir günde en fazla <strong>${maxSayi}</strong> zor ders olabilir.</p>
                    </div>
                    <div class="actions-cell" style="width: auto; min-width: 150px;">
                        <button class="btn btn-edit btn-edit-zorkural">Düzenle</button>
                        <button class="btn btn-delete btn-delete-zorkural">Sil</button>
                    </div>
                </li>
            </ul>
        `;
                }

                else {
                    formContainer.style.display = 'block';
                    gostergeContainer.style.display = 'none';
                    zorDerslerSelect.value = '';
                    maxDersInput.value = '';
                }
            }

            async function saveOgretmenKurallari() {
                const ogretmenId = document.getElementById('kural-ogretmen-sec').value;
                if (!ogretmenId) {
                    return showToast('Lütfen önce kurallarını kaydedeceğiniz öğretmeni seçin.', 'error');
                }

                const saveButton = document.getElementById('ogretmen-kural-kaydet-btn');
                const originalButtonText = saveButton.textContent;
                saveButton.textContent = 'Kaydediliyor...';
                saveButton.disabled = true;

                const zamanPlanlari = {};
                document.querySelectorAll('#ogretmen-kural-tablosu td[id]').forEach(cell => {
                    zamanPlanlari[cell.id] = cell.dataset.status || 'musait';
                });

                const kuralData = {
                    okulId: currentUserOkulId,
                    zamanPlanlari,
                    maxGunlukDers: document.getElementById('ogretmen-max-gunluk-ders').value || null,
                    maxArdisikDers: document.getElementById('ogretmen-max-ardisik-ders').value || null,
                    gunlukDenge: document.getElementById('ogretmen-gunluk-denge').value || null,
                    maxBosluk: document.getElementById('ogretmen-max-bosluk').value || null,
                };

                try {
                    await setDoc(doc(db, "ogretmen_kurallari", ogretmenId), kuralData);
                    showToast('Öğretmen kuralları başarıyla kaydedildi.', 'success');


                    await populateOgretmenKuralSelect();

                    document.getElementById('kural-ogretmen-sec').value = ogretmenId;

                } catch (e) {
                    console.error("Öğretmen kuralları kaydedilemedi:", e);
                    showToast('Kurallar kaydedilirken bir hata oluştu.', 'error');
                } finally {

                    setTimeout(() => {
                        saveButton.textContent = originalButtonText;
                        saveButton.disabled = false;
                    }, 1000);
                }
            }


            async function setupAndRenderTab(tabId) {
                const targetPane = document.getElementById(`${tabId}-tab`);
                if (!targetPane) return;


                initializeTabEventListeners(tabId);

                showSpinner();
                try {

                    switch (tabId) {
                        case 'nevi':
                            await renderSettingsList('ayarlar_personel_nevileri', 'nevi-list');
                            break;
                        case 'gorev':
                            {
                                const neviSnapshot = await getSettings('ayarlar_personel_nevileri');
                                const personelNevileri = neviSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
                                const neviSelect = document.getElementById('gorev-nevi-select');
                                neviSelect.innerHTML = '<option value="">Personel Nevi Seçin...</option>';
                                personelNevileri.forEach(nevi => neviSelect.add(new Option(nevi.name, nevi.id)));
                                await renderSettingsList('ayarlar_gorevler', 'gorev-list', personelNevileri);
                                break;
                            }
                        case 'izin-tipi':
                            await renderSettingsList('ayarlar_izin_tipleri', 'izin-tipi-list');
                            break;
                        case 'nobet-yeri':
                            await renderSettingsList('ayarlar_nobet_yerleri', 'nobet-yeri-list');
                            break;
                        case 'ders':
                            await renderSettingsList('ayarlar_dersler', 'ders-list');
                            break;
                        case 'sinif':
                            await renderSettingsList('ayarlar_siniflar', 'sinif-list');
                            break;
                        case 'derslik-yonetimi':
                            await renderSettingsList('ayarlar_derslikler', 'derslik-listesi');
                            break;
                        case 'ders-brans-kurallari':

                            await populateDersKuralFormSelects();
                            await loadAndRenderDersKurallari();
                            const toggleBtn = document.getElementById('toggle-detayli-kurallar');
                            if (toggleBtn && !toggleBtn.dataset.listener) {
                                toggleBtn.addEventListener('click', (e) => {
                                    e.preventDefault();
                                    const container = document.getElementById('detayli-kurallar-container');
                                    const isHidden = container.style.display === 'none';
                                    container.style.display = isHidden ? 'block' : 'none';
                                    toggleBtn.innerHTML = isHidden ? '▼ Detaylı Kuralları Göster/Gizle' : '▶ Detaylı Kuralları Göster/Gizle';
                                });
                                toggleBtn.dataset.listener = 'true';
                            }
                            break;
                        case 'ogrenci-kurallari':
                        case 'genel-kurallar':
                            await loadGenelKurallar();
                            break;
                        case 'seminer-donemi':
                            await renderSeminerDonemleri();
                            break;
                        case 'egitim-donemi':
                            await renderEgitimDonemleri();
                            break;
                        case 'zaman-cizelgesi':
                            await loadZamanCizelgesiAyarlari();
                            break;
                        case 'programlama-kurallari':
                            loadProgramlamaKurallari();
                            document.getElementById('programlama-kurallari-kaydet-btn').addEventListener('click', saveProgramlamaKurallari);
                            break;
                    }
                } catch (error) {
                    console.error(`${tabId} sekmesi yüklenirken hata:`, error);
                    showToast(`${tabId} verileri yüklenemedi.`, 'error');
                } finally {
                    hideSpinner();
                }
            }

            async function populateOgretmenKuralSelect() {
                const selectElement = document.getElementById('kural-ogretmen-sec');
                if (!selectElement) return;

                selectElement.innerHTML = '<option value="">Öğretmen Seçin...</option>';

                try {
                    const [personelSnap, neviSnap, ogretmenKurallariSnap] = await Promise.all([
                        getDocs(query(collection(db, 'personel'), where("okulId", "==", currentUserOkulId), orderBy('ad_soyad'))),
                        getSettings('ayarlar_personel_nevileri'),
                        getDocs(query(collection(db, 'ogretmen_kurallari'), where("okulId", "==", currentUserOkulId)))
                    ]);

                    const kuralliOgretmenler = new Set(ogretmenKurallariSnap.docs.map(doc => doc.id));
                    const egitimPersoneliNevi = neviSnap.docs.find(doc => doc.data().name.trim().includes('Eğitim Personeli'));
                    const egitimPersoneliNeviId = egitimPersoneliNevi ? egitimPersoneliNevi.id : null;

                    const bugun = new Date();
                    bugun.setHours(0, 0, 0, 0);

                    const ogretmenListesi = personelSnap.docs
                        .filter(doc => {
                            const p = doc.data();
                            const ayrilisTarihi = p.isten_ayrilis ? new Date(p.isten_ayrilis) : null;
                            const isTeacher = p.personel_nevisi === egitimPersoneliNeviId;
                            const isActive = !ayrilisTarihi || ayrilisTarihi > bugun;
                            return isTeacher && isActive;
                        })
                        .map(doc => ({ id: doc.id, name: doc.data().ad_soyad }));

                    ogretmenListesi.forEach(ogretmen => {
                        const displayName = kuralliOgretmenler.has(ogretmen.id)
                            ? `${ogretmen.name} (✓ Kuralları Var)`
                            : ogretmen.name;
                        selectElement.add(new Option(displayName, ogretmen.id));
                    });

                } catch (error) {
                    console.error("Öğretmen kuralları için öğretmen listesi yüklenemedi:", error);
                    selectElement.innerHTML = '<option value="">Liste Yüklenemedi!</option>';
                }
            }

            async function populateDersKuralFormSelects() {
                try {
                    const [derslerSnap, siniflarSnap, personelSnap, dersliklerSnap, neviSnap] = await Promise.all([
                        getSettings('ayarlar_dersler'),
                        getSettings('ayarlar_siniflar'),
                        getDocs(query(collection(db, 'personel'), where("okulId", "==", currentUserOkulId), orderBy('ad_soyad'))),
                        getSettings('ayarlar_derslikler'),
                        getSettings('ayarlar_personel_nevileri') // Personel nevilerini de çekiyoruz
                    ]);
                    const egitimPersoneliNevi = neviSnap.docs.find(doc => doc.data().name.trim().includes('Eğitim Personeli'));
                    const egitimPersoneliNeviId = egitimPersoneliNevi ? egitimPersoneliNevi.id : null;

                    const kuralDersSec = document.getElementById('kural-ders-sec');
                    const kuralSeviyeSec = document.getElementById('kural-seviye-sec');
                    const kuralOgretmenAtaSec = document.getElementById('kural-ogretmen-ata-sec');
                    const kuralYasakliDerslerSec = document.getElementById('kural-yasakli-dersler-sec');
                    const kuralDerslikTipiSec = document.getElementById('kural-derslik-tipi');

                    kuralDersSec.innerHTML = '<option value="">Ders Seçin...</option>';
                    kuralSeviyeSec.innerHTML = '';
                    kuralOgretmenAtaSec.innerHTML = '<option value="">Öğretmen Seçin (İsteğe Bağlı)...</option>';
                    kuralYasakliDerslerSec.innerHTML = '';
                    kuralDerslikTipiSec.innerHTML = '<option value="">Derslik Gerekmiyorsa Seçmeyin...</option>';

                    derslerSnap.forEach(doc => {
                        const ders = doc.data();
                        kuralDersSec.add(new Option(ders.name, doc.id));
                        kuralYasakliDerslerSec.add(new Option(ders.name, doc.id));
                    });
                    siniflarSnap.forEach(doc => {
                        kuralSeviyeSec.add(new Option(doc.data().name, doc.data().name));
                    });

                    const bugun = new Date();
                    bugun.setHours(0, 0, 0, 0);

                    personelSnap.forEach(doc => {
                        const p = doc.data();
                        const ayrilisTarihi = p.isten_ayrilis ? new Date(p.isten_ayrilis) : null;
                        if ((!ayrilisTarihi || ayrilisTarihi > bugun) && p.personel_nevisi === egitimPersoneliNeviId) {
                            kuralOgretmenAtaSec.add(new Option(p.ad_soyad, doc.id));
                        }
                    });

                    dersliklerSnap.forEach(doc => {
                        const derslik = doc.data();
                        kuralDerslikTipiSec.add(new Option(derslik.name, derslik.id));
                    });

                } catch (error) {
                    console.error("Ders kuralı form select'leri doldurulamadı:", error);
                    showToast('Form alanları yüklenirken hata oluştu.', 'error');
                }
            }

            function editDersKurali(kuralData, kuralId) {
                const formContainer = document.getElementById('ders-kurali-detaylari');
                const dersSelect = document.getElementById('kural-ders-sec');
                const seviyeSelect = document.getElementById('kural-seviye-sec');
                document.getElementById('editing-ders-kurali-id').value = kuralId;
                dersSelect.value = kuralData.dersId;
                seviyeSelect.value = kuralData.seviye;
                document.getElementById('kural-ogretmen-ata-sec').value = kuralData.atananOgretmenId || '';
                document.getElementById('kural-haftalik-saat').value = kuralData.haftalikSaat || '';
                document.getElementById('kural-gunluk-max-saat').value = kuralData.gunlukMaxSaat || '';
                document.getElementById('kural-blok-ders').value = kuralData.blokDers || 'hayir';
                document.getElementById('kural-derslik-tipi').value = kuralData.gerekenDerslikTipi || '';
                document.getElementById('kural-yerlesim-tercihi').value = kuralData.yerlesimTercihi || 'farketmez';
                const yasakliDerslerSelect = document.getElementById('kural-yasakli-dersler-sec');
                Array.from(yasakliDerslerSelect.options).forEach(opt => {
                    opt.selected = (kuralData.yasakliDersler || []).includes(opt.value);
                });
                formContainer.style.display = 'block';
                document.getElementById('ders-kural-ekle-btn').textContent = "Değişiklikleri Güncelle";
                formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }

            async function saveDersKurali() {
                const dersId = document.getElementById('kural-ders-sec').value;
                const secilenSeviyeler = Array.from(document.getElementById('kural-seviye-sec').selectedOptions).map(opt => opt.value);
                if (!dersId || secilenSeviyeler.length === 0) {
                    return showToast('Lütfen ders ve en az bir sınıf seviyesi seçin.', 'error');
                }
                showSpinner();
                const saveButton = document.getElementById('ders-kural-ekle-btn');
                saveButton.disabled = true;
                const editingId = document.getElementById('editing-ders-kurali-id').value;
                const kuralData = {
                    okulId: currentUserOkulId,
                    dersId: dersId,
                    atananOgretmenId: document.getElementById('kural-ogretmen-ata-sec').value || null,
                    haftalikSaat: document.getElementById('kural-haftalik-saat').value || null,
                    gunlukMaxSaat: document.getElementById('kural-gunluk-max-saat').value || null,
                    blokDers: document.getElementById('kural-blok-ders').value,
                    gerekenDerslikTipi: document.getElementById('kural-derslik-tipi').value || null,
                    yerlesimTercihi: document.getElementById('kural-yerlesim-tercihi').value,
                    yasakliDersler: Array.from(document.getElementById('kural-yasakli-dersler-sec').selectedOptions).map(opt => opt.value)
                };
                try {
                    if (editingId) {
                        const docRef = doc(db, "ders_kurallari", editingId);
                        await setDoc(docRef, { ...kuralData, seviye: secilenSeviyeler[0] }, { merge: true });
                        showToast('Kural başarıyla güncellendi.');
                    } else {
                        const promises = secilenSeviyeler.map(seviye => {
                            const docRef = collection(db, "ders_kurallari");
                            return addDoc(docRef, { ...kuralData, seviye: seviye });
                        });
                        await Promise.all(promises);
                        showToast(`${secilenSeviyeler.length} sınıf için kural başarıyla eklendi.`);
                    }
                    document.getElementById('ders-kurali-detaylari').querySelector('form').reset();
                    document.getElementById('kural-ders-sec').value = dersId; // Ana ders seçimini koru
                    setTimeout(() => {
                        loadAndRenderDersKurallari();
                    }, 500);
                } catch (error) {
                    console.error("Ders kuralı kaydedilirken hata:", error);
                    showToast('Kural kaydedilirken bir hata oluştu.', 'error');
                } finally {
                    hideSpinner();
                    saveButton.disabled = false;
                }
            }

            async function initializeSettings() {
                const settingsContainer = document.getElementById('settings');
                if (settingsContainer.dataset.initialized === 'true') {
                    document.getElementById('settings-panel-title').textContent = 'Uygulama Ayarları';
                    document.getElementById('settings-back-btn').classList.add('hidden');
                    settingsContainer.querySelectorAll('.settings-tab-content').forEach(pane => pane.classList.remove('active'));
                    document.getElementById('settings-grid').style.display = 'grid';
                    return;
                }
                document.getElementById('settings-grid').addEventListener('click', async (e) => {
                    const card = e.target.closest('.settings-card');
                    if (!card) return;
                    const tabId = card.dataset.tab;
                    const cardTitle = card.querySelector('.title').textContent;
                    if (tabId === 'ogretmen-kural') {
                        await loadZamanCizelgesiAyarlari();
                        createVisualScheduler();
                        document.getElementById('ogretmen-kural-modal').classList.add('open');
                        populateOgretmenKuralSelect();

                        const ogretmenSecimSelect = document.getElementById('kural-ogretmen-sec');
                        if (!ogretmenSecimSelect.dataset.listener) {
                            ogretmenSecimSelect.addEventListener('change', (e) => {
                                loadOgretmenKurallari(e.target.value);
                            });
                            ogretmenSecimSelect.dataset.listener = 'true';
                        }

                        const kaydetBtn = document.getElementById('ogretmen-kural-kaydet-btn');
                        if (!kaydetBtn.dataset.listener) {
                            kaydetBtn.addEventListener('click', saveOgretmenKurallari);
                            kaydetBtn.dataset.listener = 'true';
                        }
                        return;
                    }
                    const targetPane = document.getElementById(`${tabId}-tab`);
                    if (targetPane) {
                        document.getElementById('settings-panel-title').textContent = cardTitle;
                        document.getElementById('settings-back-btn').classList.remove('hidden');
                        document.getElementById('settings-grid').style.display = 'none';
                        settingsContainer.querySelectorAll('.settings-tab-content').forEach(pane => pane.classList.remove('active'));
                        targetPane.classList.add('active');

                        await setupAndRenderTab(tabId);
                    }
                });
                document.getElementById('settings-back-btn').addEventListener('click', () => {
                    document.getElementById('settings-panel-title').textContent = 'Uygulama Ayarları';
                    document.getElementById('settings-back-btn').classList.add('hidden');
                    settingsContainer.querySelectorAll('.settings-tab-content').forEach(pane => pane.classList.remove('active'));
                    document.getElementById('settings-grid').style.display = 'grid';
                });
                settingsContainer.addEventListener('click', async (e) => {
                    const target = e.target.closest('button, a');
                    if (!target) return;
                    if (target.matches('.btn-edit-zorkural')) {
                        document.getElementById('zor-ders-kural-gosterge').style.display = 'none';
                        document.getElementById('zor-ders-form-container').style.display = 'block';
                        return;
                    }
                    if (target.matches('.btn-delete-zorkural')) {
                        showConfirmationModal('Tanımlanmış "Zorlayıcı Ders Kuralı" silinecektir. Emin misiniz?',
                            async () => {
                                await saveGenelKurallar({ zorDersler: null, maxZorDersSayisi: null });
                                showToast('Kural silindi.');
                                await loadGenelKurallar();
                            }
                        );
                        return;
                    }
                    if (target.matches('.btn-edit-ders-kurali')) {
                        const kuralData = JSON.parse(target.dataset.kural);
                        const kuralId = target.dataset.id;
                        editDersKurali(kuralData, kuralId);
                        return;
                    }
                    if (target.matches('.btn') && target.closest('.add-setting-form') && target.id !== 'genel-bloke-ekle-btn' && target.id !== 'zor-ders-kural-kaydet-btn') {
                        const form = target.closest('.add-setting-form');
                        const tabContent = target.closest('.settings-tab-content');
                        if (!form || !tabContent) return;
                        const inputs = form.querySelectorAll('input, select');
                        const data = {};
                        let allValid = true;
                        inputs.forEach(input => {
                            if (!input.value) allValid = false;
                            const id = input.id;
                            if (id.includes('nevi-select')) data.neviId = input.value;
                            else if (id.includes('baslangic')) data.baslangic = input.value; // Önce kontrol ediliyor
                            else if (id.includes('bitis')) data.bitis = input.value; // Önce kontrol ediliyor
                            else if (id.includes('add-ders-kisaltma-input')) data.kisaltma = input.value.trim().toUpperCase();
                            else if (id.includes('add-izin-tipi-kod-input')) data.kod = input.value.trim().toUpperCase();
                            else if (id.includes('-input') || id.includes('-ad-')) data.name = input.value.trim(); // Genel kontrol sona alındı
                            else if (id.includes('derslik-tipi')) data.type = input.value;
                        });
                        if (!allValid) return showToast('Lütfen tüm alanları doldurun.', 'error');
                        const tabId = tabContent.id.replace('-tab', '');
                        let collectionName = '';
                        switch (tabId) {
                            case 'nevi': collectionName = 'ayarlar_personel_nevileri'; break;
                            case 'gorev': collectionName = 'ayarlar_gorevler'; break;
                            case 'izin-tipi': collectionName = 'ayarlar_izin_tipleri'; break;
                            case 'nobet-yeri': collectionName = 'ayarlar_nobet_yerleri'; break;
                            case 'ders': collectionName = 'ayarlar_dersler'; break;
                            case 'sinif': collectionName = 'ayarlar_siniflar'; break;
                            case 'derslik-yonetimi': collectionName = 'ayarlar_derslikler'; break;
                            case 'seminer-donemi': collectionName = 'ayarlar_seminer_donemleri'; break;
                            case 'egitim-donemi': collectionName = 'ayarlar_egitim_donemleri'; break;


                            default: return showToast('İşlem sırasında beklenmedik bir hata oluştu.', 'error');
                        }
                        await addSetting(collectionName, data);
                        showToast('Kayıt eklendi.');
                        form.querySelectorAll('input').forEach(i => i.value = '');
                        await setupAndRenderTab(tabId);
                    }
                    if (target.matches('.btn-delete-setting')) {
                        const collectionName = target.dataset.collection;
                        const id = target.dataset.id;
                        const name = target.dataset.name;
                        showConfirmationModal(`<strong>${name}</strong> adlı kaydı silmek istediğinizden emin misiniz?`, async () => {
                            await deleteSetting(collectionName, id);
                            showToast('Kayıt başarıyla silindi.');
                            const tabId = target.closest('.settings-tab-content').id.replace('-tab', '');
                            await setupAndRenderTab(tabId);
                        });
                    }
                    if (target.matches('.btn-edit-setting')) {
                        openSettingEditModal(target.dataset.id, target.dataset.collection, target.dataset.name, target.dataset.kisaltma);
                    }
                });
                settingsContainer.dataset.initialized = 'true';
            }

            function initializeTabEventListeners(tabId) {
                const tabPane = document.getElementById(`${tabId}-tab`);
                if (!tabPane || tabPane.dataset.listenersInitialized === 'true') {
                    return;
                }
                switch (tabId) {
                    case 'ders-brans-kurallari':
                        document.getElementById('ders-kural-ekle-btn').addEventListener('click', saveDersKurali);
                        document.getElementById('kural-filter-ders-select').addEventListener('change', loadAndRenderDersKurallari);
                        document.getElementById('kural-table-filter-sinif-select').addEventListener('change', loadAndRenderDersKurallari);
                        document.getElementById('kural-filter-ogretmen-select').addEventListener('change', loadAndRenderDersKurallari);
                        break;
                    case 'ogrenci-kurallari':
                        document.getElementById('zor-ders-kural-kaydet-btn').addEventListener('click', async () => {
                            const secilenDersler = Array.from(document.getElementById('kural-zor-dersler-sec').selectedOptions).map(opt => opt.value);
                            const maxSayi = parseInt(document.getElementById('kural-gunluk-max-zor-ders').value);
                            if (secilenDersler.length === 0 || isNaN(maxSayi) || maxSayi <= 0) return showToast('Lütfen zor dersleri ve geçerli bir maksimum sayı seçin.', 'error');
                            await saveGenelKurallar({ zorDersler: secilenDersler, maxZorDersSayisi: maxSayi });
                            showToast('Zorlayıcı ders kuralı kaydedildi.', 'success');
                            await loadGenelKurallar();
                        });
                        break;
                    case 'genel-kurallar':
                        document.getElementById('genel-bloke-ekle-btn').addEventListener('click', async () => {
                            const gun = document.getElementById('genel-bloke-gun').value;
                            const saat = document.getElementById('genel-bloke-saat').value;
                            if (!gun || !saat) { return showToast('Lütfen gün ve saat seçin.', 'error'); }
                            try {
                                const docRef = doc(db, "programlama_kurallari", currentUserOkulId);
                                const docSnap = await getDoc(docRef);
                                const kurallar = docSnap.exists() ? docSnap.data() : {};
                                const blokeZamanlar = [...(kurallar.blokeZamanlar || [])];
                                if (blokeZamanlar.some(z => z.gun === gun && z.saat === saat)) {
                                    return showToast('Bu zaman dilimi zaten bloke edilmiş.', 'info');
                                }
                                blokeZamanlar.push({ gun, saat });
                                await saveGenelKurallar({ blokeZamanlar });
                                showToast('Zaman dilimi bloke edildi.', 'success');
                                renderBlokeZamanListesi(blokeZamanlar);
                            } catch (error) {
                                console.error("Bloke etme işlemi sırasında hata oluştu:", error);
                                showToast('İşlem sırasında bir hata oluştu.', 'error');
                            }
                        });
                        break;
                    case 'zaman-cizelgesi':
                        document.getElementById('zaman-cizelgesi-kaydet-btn').addEventListener('click', saveZamanCizelgesiAyarlari);
                        break;
                }

                tabPane.dataset.listenersInitialized = 'true';
            }


            async function renderSeminerDonemleri() {
                const listElement = document.getElementById('seminer-donemi-list');
                if (!listElement) return;
                listElement.innerHTML = '<li>Yükleniyor...</li>';
                try {
                    const snapshot = await getDocs(query(collection(db, "ayarlar_seminer_donemleri"), where("okulId", "==", currentUserOkulId)));
                    if (snapshot.empty) {
                        listElement.innerHTML = '<li>Henüz seminer dönemi eklenmemiş.</li>';
                        return;
                    }
                    const donemler = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    donemler.sort((a, b) => new Date(b.baslangic) - new Date(a.baslangic));
                    listElement.innerHTML = '';
                    donemler.forEach(item => {
                        const li = document.createElement('li');
                        li.innerHTML = `
                <span>
                    <strong>${item.name}</strong> 
                    <small>(${formatDateDDMMYYYY(item.baslangic)} - ${formatDateDDMMYYYY(item.bitis)})</small>
                </span>
                <div class="actions-cell" style="width: auto; min-width: 120px;">
                    <button class="btn btn-delete btn-delete-setting" data-id="${item.id}" data-collection="ayarlar_seminer_donemleri" data-name="${item.name}">Sil</button>
                </div>
            `;
                        listElement.appendChild(li);
                    });
                } catch (e) {
                    listElement.innerHTML = '<li>Veri yüklenemedi.</li>';
                    console.error("Error rendering seminer dönemleri:", e);
                }
            }

            async function fetchSeminarPeriods() {
                try {
                    const snapshot = await getDocs(query(collection(db, "ayarlar_seminer_donemleri"), where("okulId", "==", currentUserOkulId)));
                    return snapshot.docs.map(doc => {
                        const data = doc.data();
                        return {
                            baslangic: new Date(data.baslangic + 'T00:00:00Z'),
                            bitis: new Date(data.bitis + 'T23:59:59Z')
                        };
                    });
                } catch (error) {
                    console.error("Seminer dönemleri çekilirken hata:", error);
                    return [];
                }
            }


            async function fetchEducationPeriods() {
                try {
                    const snapshot = await getDocs(query(collection(db, "ayarlar_egitim_donemleri"), where("okulId", "==", currentUserOkulId)));
                    return snapshot.docs.map(doc => {
                        const data = doc.data();
                        return {
                            baslangic: new Date(data.baslangic + 'T00:00:00Z'),
                            bitis: new Date(data.bitis + 'T23:59:59Z')
                        };
                    });
                } catch (error) {
                    console.error("Eğitim dönemleri çekilirken hata:", error);
                    return [];
                }
            }

            async function renderEgitimDonemleri() {
                const listElement = document.getElementById('egitim-donemi-list');
                if (!listElement) return;
                listElement.innerHTML = '<li>Yükleniyor...</li>';
                try {
                    const snapshot = await getDocs(query(collection(db, "ayarlar_egitim_donemleri"), where("okulId", "==", currentUserOkulId)));
                    if (snapshot.empty) {
                        listElement.innerHTML = '<li>Henüz eğitim dönemi eklenmemiş.</li>';
                        return;
                    }
                    const donemler = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    donemler.sort((a, b) => new Date(b.baslangic) - new Date(a.baslangic));
                    listElement.innerHTML = '';
                    donemler.forEach(item => {
                        const li = document.createElement('li');
                        li.innerHTML = `
                <span>
                    <strong>${item.name}</strong> 
                    <small>(${formatDateDDMMYYYY(item.baslangic)} - ${formatDateDDMMYYYY(item.bitis)})</small>
                </span>
                <button class="btn btn-delete btn-delete-setting" data-id="${item.id}" data-collection="ayarlar_egitim_donemleri" data-name="${item.name}">Sil</button>
            `;
                        listElement.appendChild(li);
                    });
                } catch (e) {
                    listElement.innerHTML = '<li>Veri yüklenemedi.</li>';
                    console.error("Error rendering eğitim dönemleri:", e);
                }
            }


            async function saveZamanCizelgesiAyarlari() {
                const ozelTeneffusler = [];
                document.querySelectorAll('#ozel-teneffus-listesi li').forEach(li => {
                    if (li.dataset.after && li.dataset.duration) {
                        ozelTeneffusler.push({
                            afterLesson: li.dataset.after,
                            duration: li.dataset.duration
                        });
                    }
                });
                const ayarlar = {
                    dersBaslangic: document.getElementById('setting-dersBaslangic').value,
                    toplamDers: document.getElementById('setting-toplamDers').value,
                    dersSuresi: document.getElementById('setting-dersSuresi').value,
                    teneffusSuresi: document.getElementById('setting-teneffusSuresi').value,
                    ogleArasiDersNo: document.getElementById('setting-ogleArasiDersNo').value,
                    ogleArasiSuresi: document.getElementById('setting-ogleArasiSuresi').value,
                    ozelTeneffusler: ozelTeneffusler,
                    okulId: currentUserOkulId
                };

                try {
                    await setDoc(doc(db, "genel_ayarlar", currentUserOkulId), ayarlar, { merge: true }); // merge: true eklemek daha güvenlidir.
                    showToast('Zaman çizelgesi ayarları başarıyla kaydedildi.');

                    await loadZamanCizelgesiAyarlari();
                } catch (e) {
                    console.error("Zaman çizelgesi kaydedilirken hata:", e);
                    showToast('Ayarlar kaydedilirken bir hata oluştu.', 'error');
                }
            }

            function renderZamanCizelgesiListesi() {
                const container = document.getElementById('zaman-cizelgesi-goruntule');
                if (!container) return;
                if (typeof dersSaatleri === 'undefined' || dersSaatleri.length === 0) {
                    container.innerHTML = '<p style="text-align:center; color:#777;">Görüntülenecek zaman çizelgesi için lütfen ayarları yapıp kaydedin.</p>';
                    return;
                }
                let html = '<h4>Oluşturulan Zaman Çizelgesi</h4><ul class="settings-list" style="max-height: 400px; overflow-y: auto;">';
                const ogleArasiDersNo = parseInt(zamanCizelgesiAyarlari.ogleArasiDersNo) || 0;

                dersSaatleri.forEach(slot => {
                    html += `<li style="font-weight: 500;">
                    <span style="flex-basis: 120px;"><strong>${slot.dersNo}. Ders:</strong></span>
                    <span style="font-family: monospace; font-size: 1.1em; color: var(--theme-primary);">${slot.baslangic} - ${slot.bitis}</span>
                 </li>`;
                    if (slot.dersNo === ogleArasiDersNo) {
                        html += `<li style="background-color: #eef1f3; justify-content: center; font-weight: bold; border-left: 5px solid var(--theme-accent);">ÖĞLE ARASI (${zamanCizelgesiAyarlari.ogleArasiSuresi} dk)</li>`;
                    }
                });

                html += '</ul>';
                container.innerHTML = html;
            }

            async function loadZamanCizelgesiAyarlari() {
                const varsayilanAyarlar = {
                    dersBaslangic: '08:30',
                    toplamDers: '8',
                    dersSuresi: '40',
                    teneffusSuresi: '10',
                    ogleArasiDersNo: '4',
                    ogleArasiSuresi: '45',
                    ozelTeneffusler: []
                };
                if (!currentUserOkulId) {
                    console.error("Hata: Zaman çizelgesi ayarları yüklenemedi çünkü 'currentUserOkulId' tanımlı değil.");
                    zamanCizelgesiAyarlari = varsayilanAyarlar;
                } else {
                    try {
                        const docSnap = await getDoc(doc(db, "genel_ayarlar", currentUserOkulId));
                        zamanCizelgesiAyarlari = docSnap.exists() ? docSnap.data() : varsayilanAyarlar;
                    } catch (e) {
                        console.error("Zaman çizelgesi yüklenirken hata:", e);
                        zamanCizelgesiAyarlari = varsayilanAyarlar;
                    }
                }

                document.getElementById('setting-dersBaslangic').value = zamanCizelgesiAyarlari.dersBaslangic || varsayilanAyarlar.dersBaslangic;
                document.getElementById('setting-toplamDers').value = zamanCizelgesiAyarlari.toplamDers || varsayilanAyarlar.toplamDers;
                document.getElementById('setting-dersSuresi').value = zamanCizelgesiAyarlari.dersSuresi || varsayilanAyarlar.dersSuresi;
                document.getElementById('setting-teneffusSuresi').value = zamanCizelgesiAyarlari.teneffusSuresi || varsayilanAyarlar.teneffusSuresi;
                document.getElementById('setting-ogleArasiDersNo').value = zamanCizelgesiAyarlari.ogleArasiDersNo || varsayilanAyarlar.ogleArasiDersNo;
                document.getElementById('setting-ogleArasiSuresi').value = zamanCizelgesiAyarlari.ogleArasiSuresi || varsayilanAyarlar.ogleArasiSuresi;
                renderOzelTeneffusListesi(zamanCizelgesiAyarlari.ozelTeneffusler || []);
                await generateTimeSlots();
                renderZamanCizelgesiListesi();
            }

            function renderOzelTeneffusListesi(teneffusler) {
                const listElement = document.getElementById('ozel-teneffus-listesi');
                listElement.innerHTML = ''; // Listeyi temizle
                if (!teneffusler || teneffusler.length === 0) {
                    listElement.innerHTML = '<li style="text-align:center; color:#777;">Tanımlı özel teneffüs yok.</li>';
                    return;
                }

                teneffusler.forEach((teneffus, index) => {
                    const li = document.createElement('li');
                    li.dataset.after = teneffus.afterLesson;
                    li.dataset.duration = teneffus.duration;
                    li.innerHTML = `
            <span><strong>${teneffus.afterLesson}. dersten sonra</strong> ${teneffus.duration} dakika teneffüs</span>
            <button class="btn btn-delete btn-delete-ozel-teneffus" data-index="${index}">Sil</button>
        `;
                    listElement.appendChild(li);
                });
            }
            document.getElementById('add-ozel-teneffus-btn').addEventListener('click', () => {
                const dersNoInput = document.getElementById('ozel-teneffus-ders-no');
                const sureInput = document.getElementById('ozel-teneffus-suresi');
                const dersNo = dersNoInput.value;
                const sure = sureInput.value;
                if (!dersNo || !sure) {
                    showToast('Lütfen ders numarası ve süre girin.', 'error');
                    return;
                }
                const listElement = document.getElementById('ozel-teneffus-listesi');
                if (listElement.querySelector('li').textContent.includes('yok')) {
                    listElement.innerHTML = '';
                }
                const li = document.createElement('li');
                li.dataset.after = dersNo;
                li.dataset.duration = sure;
                li.innerHTML = `
        <span><strong>${dersNo}. dersten sonra</strong> ${sure} dakika teneffüs</span>
        <button class="btn btn-delete btn-delete-ozel-teneffus">Sil</button>
    `;
                listElement.appendChild(li);
                dersNoInput.value = '';
                sureInput.value = '';
            });
            document.getElementById('ozel-teneffus-listesi').addEventListener('click', (e) => {
                if (e.target.classList.contains('btn-delete-ozel-teneffus')) {
                    e.target.closest('li').remove();

                    const listElement = document.getElementById('ozel-teneffus-listesi');
                    if (listElement.children.length === 0) {
                        listElement.innerHTML = '<li style="text-align:center; color:#777;">Tanımlı özel teneffüs yok.</li>';
                    }
                }
            });

            function showStaffListSkeleton() {
                const tableArea = document.getElementById('personel-table-area');
                let skeletonHTML = '<div class="table-container"><table class="staff-table"><thead><tr><th>S.N.</th><th>Adı Soyadı</th><th>Cinsiyet</th><th>Personel Nevisi</th><th>Görevi / Branşı</th><th>İşe Giriş</th><th>İşten Ayrılış</th><th>İşlemler</th></tr></thead><tbody>';
                for (let i = 0; i < 5; i++) {
                    skeletonHTML += `
            <tr>
                <td><div class="skeleton skeleton-cell" style="width: 30px; height: 20px;"></div></td>
                <td><div class="skeleton skeleton-cell" style="width: 150px; height: 20px;"></div></td>
                <td><div class="skeleton skeleton-cell" style="width: 60px; height: 20px;"></div></td>
                <td><div class="skeleton skeleton-cell" style="width: 120px; height: 20px;"></div></td>
                <td><div class="skeleton skeleton-cell" style="width: 120px; height: 20px;"></div></td>
                <td><div class="skeleton skeleton-cell" style="width: 80px; height: 20px;"></div></td>
                <td><div class="skeleton skeleton-cell" style="width: 80px; height: 20px;"></div></td>
                <td><div class="skeleton skeleton-cell" style="width: 210px; height: 35px;"></div></td>
            </tr>
        `;
                }
                skeletonHTML += '</tbody></table></div>';
                tableArea.innerHTML = skeletonHTML;
            }

            async function createInitialHizmetGecmisi(personelId, personelData) {
                if (!personelId || !personelData) return;

                const hizmetVerisi = {
                    okulId: currentUserOkulId,
                    gorevId: personelData.gorevi_bransi,
                    sozlesmeTuru: personelData.sozlesme_turu,
                    baslangicTarihi: personelData.ise_giris,
                    bitisTarihi: null
                };
                try {
                    const hizmetGecmisiRef = collection(db, 'personel', personelId, 'hizmetGecmisi');
                    await addDoc(hizmetGecmisiRef, hizmetVerisi);
                    console.log("İlk hizmet geçmişi kaydı oluşturuldu.");
                } catch (error) {
                    console.error("İlk hizmet geçmişi oluşturulurken hata:", error);
                }
            }



            async function updateHizmetGecmisi(personelId, yeniPersonelData, degisiklikTarihi) {
                if (!personelId || !yeniPersonelData || !degisiklikTarihi) return;

                try {
                    const hizmetGecmisiRef = collection(db, 'personel', personelId, 'hizmetGecmisi');
                    const q = query(hizmetGecmisiRef, where("bitisTarihi", "==", null), limit(1));
                    const snapshot = await getDocs(q);

                    if (!snapshot.empty) {
                        const sonKayitDoc = snapshot.docs[0];
                        const bitisTarihiObj = new Date(degisiklikTarihi + 'T00:00:00Z');
                        bitisTarihiObj.setUTCDate(bitisTarihiObj.getUTCDate() - 1);
                        const bitisTarihiStr = bitisTarihiObj.toISOString().split('T')[0];
                        await updateDoc(sonKayitDoc.ref, { bitisTarihi: bitisTarihiStr });
                    }

                    const yeniHizmetVerisi = {
                        okulId: currentUserOkulId,
                        gorevId: yeniPersonelData.gorevi_bransi,
                        sozlesmeTuru: yeniPersonelData.sozlesme_turu,
                        baslangicTarihi: degisiklikTarihi,
                        bitisTarihi: null
                    };
                    await addDoc(hizmetGecmisiRef, yeniHizmetVerisi);
                    console.log("Hizmet geçmişi güncellendi.");

                } catch (error) {
                    console.error("Hizmet geçmişi güncellenirken hata:", error);
                }
            }

            async function fetchStaff() {
                if (tumPersonelListesi.length > 0) {
                    renderPersonelListesi();
                    return;
                }
                showStaffListSkeleton();
                try {
                    const [staffSnap, neviSnap, gorevSnap] = await Promise.all([
                        getDocs(query(collection(db, "personel"), where("okulId", "==", currentUserOkulId), orderBy("ad_soyad"))),
                        getSettings('ayarlar_personel_nevileri'),
                        getSettings('ayarlar_gorevler')
                    ]);
                    tumPersonelListesi = staffSnap.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    const neviSelect = document.getElementById('filter-nevi-select');
                    const gorevSelect = document.getElementById('filter-gorev-select');
                    neviSelect.length = 1;
                    gorevSelect.length = 1;
                    neviSnap.forEach(doc => neviSelect.add(new Option(doc.data().name, doc.id)));
                    gorevSnap.forEach(doc => gorevSelect.add(new Option(doc.data().name, doc.id)));
                    document.getElementById('search-personel-input').addEventListener('input', renderPersonelListesi);
                    neviSelect.addEventListener('change', renderPersonelListesi);
                    gorevSelect.addEventListener('change', renderPersonelListesi);
                    document.getElementById('clear-personel-filters-btn').addEventListener('click', () => {
                        document.getElementById('search-personel-input').value = '';
                        document.getElementById('filter-nevi-select').value = '';
                        document.getElementById('filter-gorev-select').value = '';
                        renderPersonelListesi();
                    });
                    renderPersonelListesi();
                } catch (e) {
                    document.getElementById('personel-table-area').innerHTML = '<p style="color:red;">Personel listesi yüklenemedi.</p>';
                    console.error("Personel listesi yüklenirken hata:", e);
                }
            }
            async function renderPersonelListesi() {
                const tableContainer = document.getElementById('personel-table-area');
                tableContainer.innerHTML = '<p>Personel listesi filtreleniyor...</p>';
                const searchValue = document.getElementById('search-personel-input').value.toLowerCase();
                const neviValue = document.getElementById('filter-nevi-select').value;
                const gorevValue = document.getElementById('filter-gorev-select').value;
                let filtrelenmisPersonel = tumPersonelListesi.filter(personel => {
                    const adSoyadMatch = !searchValue || personel.ad_soyad.toLowerCase().includes(searchValue);
                    const neviMatch = !neviValue || personel.personel_nevisi === neviValue;
                    const gorevMatch = !gorevValue || personel.gorevi_bransi === gorevValue;
                    return adSoyadMatch && neviMatch && gorevMatch;
                });
                const [neviSnap, gorevSnap] = await Promise.all([
                    getSettings('ayarlar_personel_nevileri'),
                    getSettings('ayarlar_gorevler')
                ]);
                const neviMap = new Map(neviSnap.docs.map(doc => [doc.id, doc.data().name]));
                const gorevMap = new Map(gorevSnap.docs.map(doc => [doc.id, doc.data().name]));
                const aktifPersonel = [];
                const ayrilanPersonel = [];
                const bugun = new Date();
                bugun.setHours(0, 0, 0, 0);
                filtrelenmisPersonel.forEach(personel => {
                    const ayrilisTarihiStr = personel.isten_ayrilis;
                    if (ayrilisTarihiStr && ayrilisTarihiStr.trim() !== '') {
                        const ayrilisTarihi = new Date(ayrilisTarihiStr);
                        if (!isNaN(ayrilisTarihi.getTime()) && ayrilisTarihi <= bugun) {
                            ayrilanPersonel.push(personel);
                        } else {
                            aktifPersonel.push(personel);
                        }
                    } else {
                        aktifPersonel.push(personel);
                    }
                });
                const createTableHTML = (personelListesi) => {
                    if (personelListesi.length === 0) {
                        return '<p style="padding: 15px; background-color: #f8f9fa; border-radius: 5px;">Bu kriterlere uyan personel bulunmamaktadır.</p>';
                    }
                    let tableHTML = `<div class="table-container"><table class="staff-table"><thead><tr><th>S.N.</th><th>Adı Soyadı</th><th>Cinsiyet</th><th>Personel Nevisi</th><th>Görevi / Branşı</th><th>İşe Giriş</th><th>İşten Ayrılış</th><th>İşlemler</th></tr></thead><tbody>`;
                    personelListesi.forEach((s, index) => {
                        const cinsiyet = s.cinsiyet === 'kadin' ? 'Kadın' : (s.cinsiyet === 'erkek' ? 'Erkek' : '---');
                        tableHTML += `<tr>
                            <td>${index + 1}</td>
                            <td>${s.ad_soyad || ''}</td>
                            <td>${cinsiyet}</td>
                            <td>${neviMap.get(s.personel_nevisi) || 'Bilinmiyor'}</td>
                            <td>${gorevMap.get(s.gorevi_bransi) || 'Bilinmiyor'}</td>
                            <td>${formatDateDDMMYYYY(s.ise_giris)}</td>
                            <td>${formatDateDDMMYYYY(s.isten_ayrilis)}</td>
                            <td class="actions-cell">
                                <button class="btn btn-details" data-id="${s.id}" style="background-color:#0dcaf0;">Detay</button>
                                <button class="btn btn-edit" data-id="${s.id}">Düzenle</button>
                                <button class="btn btn-delete" data-id="${s.id}">Sil</button>
                            </td>
                          </tr>`;
                    });
                    tableHTML += `</tbody></table></div>`;
                    return tableHTML;
                };
                let finalHTML = '<h3>Aktif Personel Listesi</h3>';
                finalHTML += createTableHTML(aktifPersonel);
                finalHTML += '<h3 style="margin-top: 40px; border-top: 2px solid #dee2e6; padding-top: 20px;">Ayrılan Personel Listesi</h3>';
                finalHTML += createTableHTML(ayrilanPersonel);
                tableContainer.innerHTML = finalHTML;
            }

            /**
             * Verilen Personel Nevi ID'sine göre Görev/Branş dropdown menüsünü doldurur.
             */
            async function populateGorevSelect(neviId) {
                const gorevSelect = document.getElementById('gorevi_bransi');
                gorevSelect.innerHTML = '<option value="">Yükleniyor...</option>';
                if (!neviId) {
                    gorevSelect.innerHTML = '<option value="">Önce Personel Nevi Seçin</option>';
                    return;
                }
                const q = query(collection(db, 'ayarlar_gorevler'), where("okulId", "==", currentUserOkulId), where('neviId', '==', neviId));
                const gorevSnapshot = await getDocs(q);
                gorevSelect.innerHTML = '<option value="">Seçim yapınız...</option>';
                if (!gorevSnapshot.empty) {
                    gorevSnapshot.forEach(doc => gorevSelect.add(new Option(doc.data().name, doc.id)));
                }
            }

            async function loadPersonelForm(staffId = null, staffData = null) {
                const template = document.getElementById('personel-form-template');
                const formContainer = document.getElementById('personelForm');
                formContainer.innerHTML = '';
                formContainer.appendChild(template.content.cloneNode(true));
                formContainer.dataset.editingId = staffId || '';
                document.getElementById('modal-title').textContent = staffId ? 'Personel Bilgilerini Düzenle' : 'Yeni Personel Ekle';
                if (staffId && staffData) {
                    const hizmetGecmisiRef = collection(db, 'personel', staffId, 'hizmetGecmisi');
                    const hizmetSnap = await getDocs(query(hizmetGecmisiRef, limit(1)));
                    if (hizmetSnap.empty) {
                        console.log(`Hizmet geçmişi olmayan personel (${staffData.ad_soyad}) için ilk kayıt oluşturuluyor...`);
                        await createInitialHizmetGecmisi(staffId, staffData);
                    }
                }

                const neviSelect = document.getElementById('personel_nevisi');
                const gorevSelect = document.getElementById('gorevi_bransi');
                const sozlesmeTuruSelect = document.getElementById('sozlesme_turu');
                const kismiZamanliDiv = document.getElementById('kismi_zamanli_div');
                const rehberlikGoreviDiv = document.getElementById('rehberlik_gorevi_div');
                const maasKarsiligiDiv = document.getElementById('maas_karsiligi_div');
                const degisiklikTarihiDiv = document.getElementById('degisiklik_tarihi_div');
                const degisiklikTarihiInput = document.getElementById('degisiklik_tarihi');

                function updatePersonelFormVisibility() {
                    const selectedNeviText = neviSelect.options[neviSelect.selectedIndex]?.text || '';
                    const selectedContractType = sozlesmeTuruSelect.value;
                    kismiZamanliDiv.style.display = (selectedContractType === 'Kısmi Süreli') ? 'block' : 'none';
                    const isIndefinite = selectedContractType === 'Belirsiz Süreli';
                    rehberlikGoreviDiv.style.display = isIndefinite ? 'none' : 'block';
                    const isSupportStaff = selectedNeviText.toLowerCase().includes('destek personeli');
                    maasKarsiligiDiv.style.display = (isIndefinite || isSupportStaff) ? 'none' : 'block';
                }

                const neviSnapshot = await getSettings('ayarlar_personel_nevileri');
                neviSnapshot.forEach(doc => neviSelect.add(new Option(doc.data().name, doc.id)));

                neviSelect.addEventListener('change', async () => {
                    await populateGorevSelect(neviSelect.value);
                    updatePersonelFormVisibility();
                });

                sozlesmeTuruSelect.addEventListener('change', updatePersonelFormVisibility);

                if (staffId && staffData) {
                    const orijinalSozlesmeTuru = staffData.sozlesme_turu || 'Belirsiz Süreli';
                    sozlesmeTuruSelect.addEventListener('change', () => {
                        if (sozlesmeTuruSelect.value !== orijinalSozlesmeTuru) {
                            degisiklikTarihiDiv.style.display = 'block';
                            if (!degisiklikTarihiInput.value) {
                                degisiklikTarihiInput.valueAsDate = new Date();
                            }
                        } else {
                            degisiklikTarihiDiv.style.display = 'none';
                        }
                    });

                    document.getElementById('ad_soyad').value = staffData.ad_soyad || '';
                    document.getElementById('tc_kimlik_no').value = staffData.tc_kimlik_no || '';
                    document.getElementById('sgk_no').value = staffData.sgk_no || '';
                    neviSelect.value = staffData.personel_nevisi || '';
                    await populateGorevSelect(staffData.personel_nevisi);
                    gorevSelect.value = staffData.gorevi_bransi || '';
                    sozlesmeTuruSelect.value = staffData.sozlesme_turu || 'Belirsiz Süreli';
                    if (staffData.cinsiyet) document.querySelector(`input[name="cinsiyet"][value="${staffData.cinsiyet}"]`).checked = true;
                    if (staffData.es_durumu) document.querySelector(`input[name="es_durumu"][value="${staffData.es_durumu}"]`).checked = true;
                    if (staffData.rehberlik_gorevi) document.querySelector(`input[name="rehberlik_gorevi"][value="${staffData.rehberlik_gorevi}"]`).checked = true;
                    document.getElementById('cocuk_0_6').value = staffData.cocuk_0_6 || '0';
                    document.getElementById('cocuk_6_ustu').value = staffData.cocuk_6_ustu || '0';
                    document.getElementById('ise_giris').value = staffData.ise_giris || '';
                    document.getElementById('isten_ayrilis').value = staffData.isten_ayrilis || '';
                    document.getElementById('aciklama').value = staffData.aciklama || '';
                    document.getElementById('maas_karsiligi').value = staffData.maas_karsiligi || '20';

                    if (staffData.kismi_zamanli_calisma) {
                        const gunMap = { 'Pazartesi': 'pzts', 'Salı': 'sali', 'Çarşamba': 'crs', 'Perşembe': 'prs', 'Cuma': 'cuma', 'Cumartesi': 'cmrts', 'Pazar': 'pazar' };
                        for (const gun in staffData.kismi_zamanli_calisma) {
                            const shortDay = gunMap[gun];
                            if (shortDay) {
                                const checkbox = document.getElementById(`${shortDay}_calisiyor`);
                                const input = document.getElementById(`${shortDay}_saat`);
                                if (checkbox && input) { checkbox.checked = true; input.value = staffData.kismi_zamanli_calisma[gun]; }
                            }
                        }
                    }

                } else {
                    document.getElementById('ise_giris').valueAsDate = new Date();
                    document.getElementById('es_bekar').checked = true;
                }
                updatePersonelFormVisibility();
            }
            let currentView = 'sinif';
            let classList = [];
            let teacherList = [];
            const dersSaatleri = [];
            async function publishSchedule() {
                const etkinTarih = document.getElementById('etkinTarihInput').value;
                if (!etkinTarih) {
                    return showToast('Yayınlamadan önce "Programın Geçerlilik Başlangıç Tarihi" seçilmelidir.', 'error');
                }
                const varsayilanAd = `${formatDateDDMMYYYY(etkinTarih)} Yayınlanan Program`;

                showConfirmationModal(
                    `<strong>Tüm Sınıfların Programı Yayınlanacak</strong><br><br>Bu işlem, mevcut programı tüm sınıflar için "${varsayilanAd}" adıyla kaydedecek ve yayınlanmış olarak işaretleyecektir. Devam etmek istiyor musunuz?`,
                    () => saveAllSchedules(true, varsayilanAd), // programAdi parametresi eklendi
                    'Evet, Yayınla',
                    'add'
                );
            }
            async function saveAllSchedules(isPublishing = false, programAdi = '') {
                const etkinTarih = document.getElementById('etkinTarihInput').value;
                if (!etkinTarih) {
                    return showToast('İşlem yapmadan önce "Programın Geçerlilik Başlangıç Tarihi" seçilmelidir.', 'error');
                }
                if (!window.tumProgramlar || Object.keys(window.tumProgramlar).length === 0) {
                    return showToast('Kaydedilecek bir program verisi bulunmuyor.', 'info');
                }
                showSpinner();
                const actionText = isPublishing ? 'yayınlanıyor' : 'kaydediliyor';
                showToast(`Tüm programlar ${actionText}...`, 'info');
                try {
                    const savePromises = Object.keys(window.tumProgramlar).map(sinifAdi =>
                        saveScheduleForClass(sinifAdi, etkinTarih, programAdi)
                    );
                    await Promise.all(savePromises);
                    const successMessage = `Tüm sınıfların programları başarıyla ${actionText}!`;
                    showToast(successMessage, 'success');
                    if (window.aktifGrup) {
                        renderVersionList(window.aktifGrup.replace(/\//g, '-'));
                    }
                } catch (error) {
                    showToast(error.message, 'error');
                } finally {
                    hideSpinner();
                }
            }
            async function saveScheduleForClass(sinifAdi, etkinTarih, programAdi) {
                const sanitizedSinifAdi = `${currentUserOkulId}_${sinifAdi.replace(/\//g, '-')}`;
                const docRef = doc(db, "ders_programlari", sanitizedSinifAdi, "versiyonlar", etkinTarih);
                const dataToSave = {
                    ...window.tumProgramlar[sinifAdi],
                    okulId: currentUserOkulId,
                    programAdi: programAdi
                };
                try {
                    await setDoc(docRef, dataToSave);
                } catch (error) {
                    throw new Error(`${sinifAdi} programı kaydedilemedi.`);
                }
            }
            let dersKurallariListesi = [];
            let guncelYukluVersiyonTarihi = null;
            async function initializeSchedule() {
                await loadDersKisaltmaMap();
                const displayArea = document.getElementById('schedule-display-area');
                displayArea.innerHTML = '<p>Ders programı verileri yükleniyor...</p>';

                try {
                    if (!currentUserOkulId) {
                        throw new Error('Ders programını görüntülemek için önce bir okul seçmelisiniz.');
                    }
                    const dersKurallariSnap = await getDocs(query(collection(db, 'ders_kurallari'), where("okulId", "==", currentUserOkulId)));
                    dersKurallariListesi = dersKurallariSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    window.dersKurallariListesi = dersKurallariListesi; // Diğer fonksiyonlardan erişim için
                    await loadZamanCizelgesiAyarlari();
                    const derslerSnap = await getSettings('ayarlar_dersler');
                    const dersler = derslerSnap.docs.map(d => ({ id: d.id, name: d.data().name }));
                    const dersSelect = document.getElementById('dersAdi');
                    dersSelect.innerHTML = '<option value="">Ders Seçin...</option>';
                    dersler.forEach(ders => dersSelect.add(new Option(ders.name, ders.id)));
                    const ogretmenSelect = document.getElementById('ogretmen');
                    ogretmenSelect.innerHTML = '<option value="">Öğretmen Seçin...</option>';
                    window.teacherList.forEach(p => ogretmenSelect.add(new Option(p.name, p.id)));
                    window.tumProgramlar = {};
                    await generateTimeSlots();
                    if (!document.getElementById('sinif-gorunum-btn')._initialized) {

                        document.getElementById('programi-yazdir-btn').addEventListener('click', () => {
                            const selectedGroup = document.getElementById('grup-secim-dropdown').options[document.getElementById('grup-secim-dropdown').selectedIndex].text;
                            document.getElementById('schedule-print-title').textContent = `${selectedGroup} Haftalık Ders Programı`;
                            window.print();
                        });
                        document.getElementById('sinif-gorunum-btn').addEventListener('click', () => switchView('sinif'));
                        document.getElementById('ogretmen-gorunum-btn').addEventListener('click', () => switchView('ogretmen'));
                        document.getElementById('matris-ogretmen-gorunum-btn').addEventListener('click', () => switchView('matris-ogretmen'));
                        document.getElementById('matris-sinif-gorunum-btn').addEventListener('click', () => switchView('matris-sinif'));
                        document.querySelector('#matrix-modal .close-modal').addEventListener('click', () => {
                            document.getElementById('matrix-modal').classList.remove('open');
                        });
                        document.getElementById('grup-secim-dropdown').addEventListener('change', (e) => {
                            const selectedValue = e.target.value;
                            if (currentView === 'sinif') {
                                loadScheduleForClass(selectedValue);
                            } else {
                                const selectedOption = e.target.options[e.target.selectedIndex];
                                loadScheduleForTeacher(selectedValue, selectedOption.text);
                            }
                            renderYerlestirmeHavuzu();
                        });
                        document.getElementById('ekleBtn').addEventListener('click', () => addLesson(false));
                        document.getElementById('programi-kaydet-btn').addEventListener('click', () => {
                            const etkinTarih = document.getElementById('etkinTarihInput').value;
                            if (!etkinTarih) {
                                return showToast('Kaydetmeden önce "Programın Geçerlilik Başlangıç Tarihi" seçilmelidir.', 'error');
                            }
                            const modal = document.getElementById('save-schedule-modal');
                            document.getElementById('schedule-date-display').value = formatDateDDMMYYYY(etkinTarih);
                            document.getElementById('schedule-name-input').value = ''; // Input'u temizle
                            modal.classList.add('open');
                        });
                        document.getElementById('save-schedule-with-name-btn').addEventListener('click', () => {
                            const programAdi = document.getElementById('schedule-name-input').value.trim();
                            const etkinTarih = document.getElementById('etkinTarihInput').value;
                            if (!programAdi) {
                                return showToast('Lütfen programa bir isim verin.', 'error');
                            }
                            saveAllSchedules(false, programAdi);
                            document.getElementById('save-schedule-modal').classList.remove('open');
                        });
                        document.querySelector('#save-schedule-modal .close-modal').addEventListener('click', () => {
                            document.getElementById('save-schedule-modal').classList.remove('open');
                        });
                        document.getElementById('programi-yayinla-btn').addEventListener('click', publishSchedule);
                        document.getElementById('btn-otomatik-doldur').addEventListener('click', runAutomaticScheduler);
                        document.getElementById('programi-duzenle-btn').addEventListener('click', () => {
                            if (currentView !== 'sinif') {
                                return showToast('Düzenleme işlemi sadece Sınıf Görünümünde yapılabilir.', 'error');
                            }
                            if (guncelYukluVersiyonTarihi) {
                                document.getElementById('etkinTarihInput').value = guncelYukluVersiyonTarihi;
                                showToast(`Program tarihi ${formatDateDDMMYYYY(guncelYukluVersiyonTarihi)} olarak ayarlandı. Değişiklikleri kalıcı yapmak için 'Kaydet' butonuna tıklayın.`, 'info');
                            } else {
                                showToast('Önce versiyon listesinden düzenlenecek bir program yükleyin.', 'error');
                            }
                        });
                        document.getElementById('programi-kopyala-btn').addEventListener('click', () => {
                            if (currentView !== 'sinif') {
                                return showToast('Kopyalama işlemi sadece Sınıf Görünümünde yapılabilir.', 'error');
                            }
                            if (!window.aktifGrup || !window.tumProgramlar[window.aktifGrup]) {
                                return showToast('Kopyalanacak bir program verisi bulunmuyor.', 'error');
                            }

                            const modal = document.getElementById('kopyala-program-modal');
                            const tarihInput = document.getElementById('kopya-tarih-input');
                            tarihInput.valueAsDate = new Date(); // Tarih alanını bugün olarak ayarla
                            modal.classList.add('open');
                        });
                        document.querySelector('#kopyala-program-modal .close-modal').addEventListener('click', () => {
                            document.getElementById('kopyala-program-modal').classList.remove('open');
                        });
                        document.getElementById('kaydet-kopya-btn').addEventListener('click', async () => {
                            const yeniTarih = document.getElementById('kopya-tarih-input').value;
                            if (!yeniTarih) {
                                return showToast('Lütfen geçerli bir tarih seçin.', 'error');
                            }

                            showSpinner();
                            try {

                                await saveScheduleForClass(window.aktifGrup, yeniTarih);
                                showToast(`Program, ${formatDateDDMMYYYY(yeniTarih)} tarihi için başarıyla kopyalandı.`, 'success');


                                await renderVersionList(window.aktifGrup.replace(/\//g, '-'));
                                document.getElementById('etkinTarihInput').value = yeniTarih;
                                guncelYukluVersiyonTarihi = yeniTarih; // Güncel tarihi güncelle

                                document.getElementById('kopyala-program-modal').classList.remove('open');
                            } catch (error) {
                                showToast(`Kopyalama sırasında hata: ${error.message}`, 'error');
                            } finally {
                                hideSpinner();
                            }
                        });
                        document.getElementById('sinif-gorunum-btn')._initialized = true;
                    }
                    await switchView('sinif');
                    await renderYerlestirmeHavuzu();

                } catch (error) {
                    console.error("Ders programı başlatılırken hata:", error);
                    displayArea.innerHTML = `<p style="color:red; font-weight:bold; text-align:center; line-height:1.6;">${error.message}</p>`;
                    showToast('Ders programı yüklenemedi.', 'error');
                }
            }

            async function switchView(viewType) {
                currentView = viewType;
                const buttons = {
                    sinif: document.getElementById('sinif-gorunum-btn'),
                    ogretmen: document.getElementById('ogretmen-gorunum-btn'),
                    'matris-ogretmen': document.getElementById('matris-ogretmen-gorunum-btn'),
                    'matris-sinif': document.getElementById('matris-sinif-gorunum-btn')
                };
                const label = document.getElementById('grup-gorunum-label');
                const dropdown = document.getElementById('grup-secim-dropdown');
                const displayArea = document.getElementById('schedule-display-area');
                Object.values(buttons).forEach(btn => btn.classList.remove('active'));
                if (buttons[viewType]) {
                    buttons[viewType].classList.add('active');
                }
                const matrixModal = document.getElementById('matrix-modal');
                matrixModal.classList.remove('open');
                showSpinner();
                try {
                    if (viewType.startsWith('matris') && (!window.tumProgramlar || Object.keys(window.tumProgramlar).length < window.classList.length)) {
                        for (const sinif of window.classList) {
                            if (!window.tumProgramlar[sinif]) {
                                const sanitizedSinifAdi = `${currentUserOkulId}_${sinif.replace(/\//g, '-')}`;
                                const versionsRef = collection(db, "ders_programlari", sanitizedSinifAdi, "versiyonlar");
                                const q = query(versionsRef, orderBy(documentId(), "desc"), limit(1));
                                const snapshot = await getDocs(q);
                                window.tumProgramlar[sinif] = snapshot.empty ? {} : snapshot.docs[0].data();
                            }
                        }
                    }
                    if (viewType === 'sinif' || viewType === 'ogretmen') {
                        label.style.display = 'block';
                        dropdown.style.display = 'block';
                        dropdown.innerHTML = '';
                        if (viewType === 'sinif') {
                            label.textContent = 'Görüntülenecek Grup (Sınıf)';
                            window.classList.forEach(sinif => dropdown.add(new Option(sinif, sinif)));
                            await loadScheduleForClass(window.classList[0]);
                        } else {
                            label.textContent = 'Görüntülenecek Grup (Öğretmen)';
                            window.teacherList.forEach(ogretmen => dropdown.add(new Option(ogretmen.name, ogretmen.id)));
                            await loadScheduleForTeacher(window.teacherList[0].id, window.teacherList[0].name);
                        }
                    } else {
                        label.style.display = 'none';
                        dropdown.style.display = 'none';
                        displayArea.innerHTML = '';
                        const modalTitle = document.getElementById('matrix-modal-title');
                        if (viewType === 'matris-ogretmen') {
                            modalTitle.textContent = 'Matris: Öğretmen / Sınıf Görünümü';
                            await renderTeacherClassMatrix('matrix-modal-body');
                        } else if (viewType === 'matris-sinif') {
                            modalTitle.textContent = 'Matris: Sınıf / Zaman Çizelgesi Görünümü';
                            await renderClassTimeSlotMatrix('matrix-modal-body');
                        }
                        matrixModal.classList.add('open');
                    }

                } catch (error) {
                    console.error("Görünüm değiştirilirken hata oluştu:", error);
                    displayArea.innerHTML = `<p style="color:red">Görünüm yüklenirken bir hata oluştu: ${error.message}</p>`;
                } finally {
                    hideSpinner();
                }
            }

            async function fetchScheduleDataForClass(sinifAdi) {
                const sanitizedSinifAdi = `${currentUserOkulId}_${sinifAdi.replace(/\//g, '-')}`;
                const versionsRef = collection(db, "ders_programlari", sanitizedSinifAdi, "versiyonlar");
                const today = new Date();
                today.setHours(23, 59, 59, 999);
                const todayString = today.toISOString().split('T')[0];
                const q = query(versionsRef, where(documentId(), "<=", todayString), orderBy(documentId(), "desc"), limit(1));
                const snapshot = await getDocs(q);
                return snapshot.empty ? {} : snapshot.docs[0].data();
            }

            async function loadScheduleForClass(sinifAdi) {
                window.aktifGrup = sinifAdi;
                document.getElementById('aktif-versiyon-bilgisi').textContent = 'En güncel versiyon yükleniyor...';
                try {
                    const scheduleData = await fetchScheduleDataForClass(sinifAdi);
                    window.tumProgramlar[sinifAdi] = scheduleData;
                } catch (error) {
                    console.error("Ders programı yüklenirken hata:", error);
                    window.tumProgramlar[sinifAdi] = {};
                }
                renderSchedule();
                renderVersionList(sinifAdi.replace(/\//g, '-'));
            }


            async function loadScheduleForTeacher(teacherId, teacherName) {
                window.aktifGrup = teacherName;
                showSpinner();
                try {
                    for (const sinif of window.classList) {
                        if (!window.tumProgramlar[sinif]) {
                            window.tumProgramlar[sinif] = await fetchScheduleDataForClass(sinif);
                        }
                    }
                    let teacherSchedule = {};
                    for (const sinifAdi of window.classList) {
                        const sinifProgrami = window.tumProgramlar[sinifAdi];
                        if (!sinifProgrami) continue;
                        for (const gun in sinifProgrami) {
                            if (["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"].includes(gun)) {
                                for (const dersNoStr in sinifProgrami[gun]) {
                                    const dersNo = parseInt(dersNoStr); // Anahtar artık ders numarası (string olabilir, parse edelim)
                                    if (isNaN(dersNo)) continue; // Geçersiz anahtarı atla

                                    const dersData = sinifProgrami[gun][dersNo]; // dersNo ile veriyi al
                                    if (dersData && dersData.ogretmen === teacherName) {
                                        if (!teacherSchedule[gun]) teacherSchedule[gun] = {};
                                        teacherSchedule[gun][dersNo] = { // Anahtar 'dersNo'
                                            sinif: sinifAdi,
                                            dersAdi: dersData.dersAdi
                                        };
                                    }
                                }
                            }
                        }
                    }
                    window.tumProgramlar[teacherName] = teacherSchedule;
                    renderSchedule();
                    document.getElementById('aktif-versiyon-bilgisi').textContent = `${teacherName} adlı öğretmenin programı görüntüleniyor.`;
                    document.getElementById('versiyon-listesi').innerHTML = '<li>Öğretmen görünümünde versiyon listesi bulunmamaktadır.</li>';

                } catch (error) {
                    console.error("Öğretmen programı yüklenirken hata:", error);
                    showToast('Öğretmen programı yüklenemedi.', 'error');
                } finally {
                    hideSpinner();
                }
            }

            function timeStringToMinutes(timeStr) {
                const [hours, minutes] = timeStr.split(':').map(Number);
                return hours * 60 + minutes;
            }

            async function renderTeacherClassMatrix(containerId) {
                const displayArea = document.getElementById(containerId);
                if (!displayArea) return;
                const gunler = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
                const toplamSaat = dersSaatleri.length; // dersSaatleri'nin güncel olduğundan emin olun
                if (toplamSaat === 0) {
                    displayArea.innerHTML = "<p>Zaman çizelgesi ayarları yüklenemediği için matris oluşturulamıyor.</p>";
                    return;
                }
                const headerBgColor = '#e6f7ff'; // Sabit renk
                const teacherSchedules = {}; // Öğretmen programlarını tutacak nesne

                // Mevcut öğretmen listesini alalım
                const currentTeacherList = window.teacherList || [];
                currentTeacherList.forEach(teacher => {
                    teacherSchedules[teacher.name] = {}; // Her öğretmen için boş program nesnesi oluştur
                });


                // Tüm sınıfların programlarını dolaşarak öğretmen programlarını doldur
                for (const sinifAdi in window.tumProgramlar) {
                    // Sadece geçerli sınıf listesindekileri işle (opsiyonel ama iyi bir kontrol)
                    if (!window.classList || !window.classList.includes(sinifAdi)) continue;

                    const sinifProgrami = window.tumProgramlar[sinifAdi];
                    for (const gun in sinifProgrami) {
                        // Sadece geçerli günleri işle
                        if (!gunler.includes(gun)) continue;

                        // --- DEĞİŞİKLİK: 'saat' yerine 'dersNo' anahtarı üzerinden dön ---
                        for (const dersNoStr in sinifProgrami[gun]) {
                            const dersNo = parseInt(dersNoStr); // Anahtar artık ders numarası (string olabilir)
                            if (isNaN(dersNo)) continue; // Geçersiz anahtarı atla

                            const dersData = sinifProgrami[gun][dersNo]; // dersNo ile veriyi al

                            // Eğer ders verisi, öğretmeni varsa ve bu öğretmen listemizdeyse işle
                            if (dersData && dersData.ogretmen && teacherSchedules[dersData.ogretmen]) {
                                // Anahtarı "Gün-DersNo" formatında oluştur ve sınıf adını ata
                                teacherSchedules[dersData.ogretmen][`${gun}-${dersNo}`] = sinifAdi;
                            }
                        }
                    }
                }

                // Tablo HTML'ini oluşturma (Bu kısım büyük ölçüde aynı kalabilir)
                let tableHTML = `<div class="table-container" style="max-height: 80vh;">
                       <table class="schedule-table" style="font-size: 11px; table-layout: fixed; border-spacing: 0;">
                         <thead>
                           <tr style="height: auto;">
                             <th rowspan="2" style="position: sticky; left: 0; z-index: 2; vertical-align: middle; width: 150px; border-bottom: 1px solid #dee2e6; background-color: ${headerBgColor};">Öğretmen</th>`; // Sticky eklendi

                gunler.forEach(gun => {
                    tableHTML += `<th colspan="${toplamSaat}" style="padding: 4px 0; line-height: 1.2; background-color: ${headerBgColor};">${gun}</th>`;
                });
                tableHTML += `</tr><tr style="height: auto;">`;

                gunler.forEach(() => {
                    for (let i = 1; i <= toplamSaat; i++) {
                        tableHTML += `<th style="width: 35px; padding: 3px 2px; height: 22px; line-height: 1.2; background-color: ${headerBgColor};">${i}</th>`;
                    }
                });
                tableHTML += `</tr></thead><tbody>`;

                // Öğretmenleri isme göre sırala ve tabloya ekle
                currentTeacherList.sort((a, b) => a.name.localeCompare(b.name, 'tr')).forEach(teacher => {
                    tableHTML += `<tr>
                        <th style="position: sticky; left: 0; z-index: 1; background-color: #f8f9fa; text-align: left; padding-left: 5px; white-space: nowrap; vertical-align: middle; height: 35px;">${teacher.name}</th>`; // Sticky eklendi
                    gunler.forEach((gun, gunIndex) => {
                        const zebraBg = gunIndex % 2 === 0 ? '#f0f0f0' : '#ffffff'; // Farklı zebra rengi
                        for (let i = 1; i <= toplamSaat; i++) {
                            const cellKey = `${gun}-${i}`;
                            const sinif = teacherSchedules[teacher.name]?.[cellKey]; // Güvenli erişim

                            if (sinif) {
                                const bgColor = stringToColor(sinif); // Renk fonksiyonu kullanılmaya devam ediyor
                                const textColor = getContrastColor(bgColor); // Kontrast renk fonksiyonu
                                tableHTML += `<td style="background-color: ${bgColor}; color: ${textColor}; font-weight: 500; text-align: center; padding: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; vertical-align: middle; height: 35px;" title="${sinif}">
                                    ${sinif}
                                  </td>`;
                            } else {
                                // Boş hücre
                                tableHTML += `<td style="height: 35px; background-color: ${zebraBg};"></td>`;
                            }
                        }
                    });
                    tableHTML += `</tr>`;
                });

                tableHTML += `</tbody></table></div>`;
                displayArea.innerHTML = tableHTML; // Oluşturulan HTML'i ekrana bas
            }

            async function renderClassTimeSlotMatrix(containerId) {
                const displayArea = document.getElementById(containerId);
                if (!displayArea) return;

                const gunler = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
                const toplamSaat = dersSaatleri.length; // dersSaatleri'nin güncel olduğundan emin olun
                if (toplamSaat === 0) {
                    displayArea.innerHTML = "<p>Zaman çizelgesi ayarları yüklenemediği için matris oluşturulamıyor.</p>";
                    return;
                }


                // Tablo başlığını oluşturma (Bu kısım aynı kalabilir)
                let tableHTML = `<div class="table-container" style="max-height: 80vh;">
                       <table class="schedule-table" style="font-size: 11px; table-layout: fixed;">
                         <thead>
                           <tr style="height: auto;">
                              <th rowspan="2" style="position: sticky; left: 0; z-index: 2; vertical-align: middle; width: 100px; background-color: #e9ecef;">Sınıf</th>`; // Sticky eklendi
                gunler.forEach(gun => {
                    tableHTML += `<th colspan="${toplamSaat}" style="background-color: #e9ecef;">${gun}</th>`;
                });
                tableHTML += `</tr><tr style="height: auto;">`;
                gunler.forEach(() => {
                    dersSaatleri.forEach(slot => {
                        tableHTML += `<th style="width: 40px; padding: 2px; height: 25px; background-color: #e9ecef;">${slot.dersNo}</th>`;
                    });
                });
                tableHTML += `</tr></thead><tbody>`;

                // Sınıfları alıp sıralama (Bu kısım aynı kalabilir)
                const sortedClasses = [...(window.classList || [])].sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }));

                // Her sınıf için satır oluşturma
                sortedClasses.forEach(sinifAdi => {
                    tableHTML += `<tr>
                        <th style="position: sticky; left: 0; z-index: 1; background-color: #f8f9fa; text-align: left; padding-left: 5px; vertical-align: middle; height: 40px;">${sinifAdi}</th>`; // Sticky eklendi
                    const sinifProgrami = window.tumProgramlar?.[sinifAdi] || {}; // Güvenli erişim

                    // Her gün ve her ders saati için hücre oluşturma
                    gunler.forEach(gun => {
                        dersSaatleri.forEach(slot => { // dersSaatleri dizisini kullanıyoruz
                            // --- DEĞİŞİKLİK: slot.baslangic yerine slot.dersNo ile eriş ---
                            const dersData = sinifProgrami[gun]?.[slot.dersNo]; // Anahtar olarak slot.dersNo kullanılıyor

                            if (dersData && dersData.dersAdi) {
                                // Ders varsa: Kısaltma, renk ve tooltip oluşturma (Bu kısım aynı kalabilir)
                                const kisaAd = window.dersKisaltmaMap.get(dersData.dersAdi) || '???';
                                const bgColor = stringToColor(dersData.dersAdi);
                                const textColor = getContrastColor(bgColor);
                                const tooltip = `Ders: ${dersData.dersAdi}\nÖğretmen: ${dersData.ogretmen || 'Atanmamış'}`; // Tooltip bilgisi aynı

                                tableHTML += `<td style="background-color: ${bgColor}; color: ${textColor}; font-weight: 500; text-align: center; padding: 4px; white-space: nowrap; vertical-align: middle; height: 40px;" title="${tooltip}">${kisaAd}</td>`;
                            } else {
                                // Ders yoksa boş hücre
                                tableHTML += `<td style="height: 40px;"></td>`;
                            }
                        });
                    });
                    tableHTML += `</tr>`;
                });

                tableHTML += `</tbody></table></div>`;
                displayArea.innerHTML = tableHTML; // Oluşturulan HTML'i ekrana bas
            }



            async function renderClassSubjectMatrix() {
                const displayArea = document.getElementById('schedule-display-area');
                const allSubjects = new Set();
                const classHourCounts = {};
                window.classList.forEach(sinif => {
                    classHourCounts[sinif] = {};
                });
                for (const sinifAdi in window.tumProgramlar) {
                    if (!window.classList.includes(sinifAdi)) continue;
                    for (const gun in window.tumProgramlar[sinifAdi]) {
                        for (const saat in window.tumProgramlar[sinifAdi][gun]) {
                            const dersData = window.tumProgramlar[sinifAdi][gun][saat];
                            if (dersData && dersData.dersAdi) {
                                allSubjects.add(dersData.dersAdi);
                                classHourCounts[sinifAdi][dersData.dersAdi] = (classHourCounts[sinifAdi][dersData.dersAdi] || 0) + 1;
                            }
                        }
                    }
                }
                const sortedSubjects = Array.from(allSubjects).sort();
                let tableHTML = `<div class="table-container">
                       <table class="staff-table">
                         <thead>
                           <tr>
                             <th>Sınıf</th>`;
                sortedSubjects.forEach(subject => {
                    tableHTML += `<th>${subject}</th>`;
                });
                tableHTML += `<th>Haftalık Toplam</th></tr></thead><tbody>`;
                window.classList.sort().forEach(sinif => {
                    let weeklyTotal = 0;
                    tableHTML += `<tr><td><strong>${sinif}</strong></td>`;
                    sortedSubjects.forEach(subject => {
                        const count = classHourCounts[sinif][subject] || 0;
                        weeklyTotal += count;
                        tableHTML += `<td>${count > 0 ? count : ''}</td>`;
                    });
                    tableHTML += `<td><strong>${weeklyTotal}</strong></td>`;
                    tableHTML += `</tr>`;
                });
                tableHTML += `</tbody></table></div>`;
                displayArea.innerHTML = tableHTML;
            }

            async function loadDersKisaltmaMap() {
                try {
                    const derslerSnap = await getSettings('ayarlar_dersler');
                    window.dersKisaltmaMap = new Map();
                    derslerSnap.forEach(doc => {
                        const ders = doc.data();
                        window.dersKisaltmaMap.set(ders.name, ders.kisaltma || '???');
                    });
                } catch (error) {
                    console.error("Ders kısaltma haritası oluşturulurken hata:", error);
                    window.dersKisaltmaMap = new Map();
                }
            }

            function renderSchedule() {
                const displayArea = document.getElementById('schedule-display-area');
                const gunler = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
                const standartTeneffus = parseInt(zamanCizelgesiAyarlari.teneffusSuresi) || 10;
                const ogleArasiDersNo = parseInt(zamanCizelgesiAyarlari.ogleArasiDersNo) || 0;
                let tableHTML = '<h2 id="schedule-print-title"></h2>';
                tableHTML += '<table class="schedule-table"><thead><tr><th>Saatler</th>';
                gunler.forEach(gun => tableHTML += `<th>${gun}</th>`);
                tableHTML += '</tr></thead><tbody>';
                const mevcutProgram = window.tumProgramlar[window.aktifGrup] || {};
                dersSaatleri.forEach((slot, index, array) => {
                    tableHTML += `<tr><th>${slot.dersNo}. Ders<br>${slot.baslangic}-${slot.bitis}</th>`;
                    gunler.forEach(gun => {
                        const dersData = mevcutProgram[gun]?.[slot.dersNo]; // slot.baslangic yerine slot.dersNo
                        const conflictClass = dersData && dersData.hasConflict ? 'has-conflict' : '';
                        tableHTML += `<td data-gun="${gun}" data-saat="${slot.baslangic}" data-ders-no="${slot.dersNo}">`; // data-ders-no eklendi
                        if (dersData) {
                            const bgColor = stringToColor(dersData.dersAdi);
                            const textColor = getContrastColor(bgColor);
                            const tooltipText = `Öğretmen: ${dersData.ogretmen || 'Atanmamış'}`;
                            const strongText = currentView === 'sinif' ? dersData.ogretmen : (dersData.sinif || ''); // Öğretmen görünümü için sınıf eklendi
                            tableHTML += `<div class="ders-karti ${conflictClass}"
                               style="background-color: ${bgColor}; color: ${textColor};"
                               data-tooltip="${tooltipText}">
                               <button class="delete-lesson-btn" title="Dersi Sil">×</button>
                               <strong>${strongText || ''}</strong>
                               <span>${dersData.dersAdi || ''}</span>
                          </div>`;
                        }
                        tableHTML += `</td>`;
                    });
                    tableHTML += '</tr>';
                    if (index < array.length - 1) {
                        const sonrakiSlot = array[index + 1];
                        const buDersinBitisi = timeStringToMinutes(slot.bitis);
                        const sonrakiDersinBaslangici = timeStringToMinutes(sonrakiSlot.baslangic);
                        const araSuresi = sonrakiDersinBaslangici - buDersinBitisi;
                        if (araSuresi > standartTeneffus) {
                            const araAdi = slot.dersNo === ogleArasiDersNo ? "ÖĞLE ARASI" : "ARA";
                            tableHTML += `<tr><td colspan="6" style="background:#e9ecef;font-weight:bold; height: 35px; vertical-align: middle;">${araAdi} (${araSuresi} dk)</td></tr>`;
                        }
                    }
                });

                displayArea.innerHTML = tableHTML + `</tbody></table>`;

                if (currentView === 'sinif') {
                    document.querySelectorAll('.delete-lesson-btn').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            const td = e.target.closest('td');
                            deleteLesson(td.dataset.gun, parseInt(td.dataset.dersNo)); // td.dataset.saat yerine td.dataset.dersNo
                        });
                    });
                    attachDragDropListeners();
                } else {
                    document.querySelectorAll('.delete-lesson-btn').forEach(btn => btn.style.display = 'none');
                }
            }

            async function renderVersionList(sinifAdi) {
                const sanitizedSinifAdi = `${currentUserOkulId}_${sinifAdi.replace(/\//g, '-')}`;
                const versiyonListesiUL = document.getElementById('versiyon-listesi');
                if (!versiyonListesiUL) return;

                versiyonListesiUL.innerHTML = '<li>Versiyonlar yükleniyor...</li>';
                const versionsRef = collection(db, "ders_programlari", sanitizedSinifAdi, "versiyonlar");
                const q = query(versionsRef, orderBy(documentId(), "desc"));
                try {
                    const snapshot = await getDocs(q);
                    versiyonListesiUL.innerHTML = '';
                    if (snapshot.empty) {
                        versiyonListesiUL.innerHTML = '<li>Bu sınıf için kayıtlı program versiyonu yok.</li>';
                        return;
                    }
                    snapshot.forEach(doc => {
                        const li = document.createElement('li');
                        const programVerisi = doc.data();
                        li.innerHTML = `
    <a href="#" data-tarih="${doc.id}" style="text-decoration: none; color: #0056b3; font-weight: 500; display: block;">
        <strong style="display: block; font-size: 1.05em;">${programVerisi.programAdi || 'İsimsiz Program'}</strong>
        <small style="color: #555;">${formatDateDDMMYYYY(doc.id)}</small>
    </a>
    <button class="btn-delete-version" data-tarih="${doc.id}" data-sinif="${sinifAdi}">Sil</button>
`;
                        versiyonListesiUL.appendChild(li);
                    });
                    if (!versiyonListesiUL.dataset.listenerAttached) {
                        versiyonListesiUL.addEventListener('click', async (e) => {
                            const currentClass = document.getElementById('grup-secim-dropdown').value;
                            if (!currentClass) return;
                            const currentSanitizedClass = `${currentUserOkulId}_${currentClass.replace(/\//g, '-')}`;

                            const link = e.target.closest('a');
                            const deleteButton = e.target.closest('.btn-delete-version');

                            if (link) {
                                e.preventDefault();
                                const tarih = link.dataset.tarih;
                                const docRef = doc(db, "ders_programlari", currentSanitizedClass, "versiyonlar", tarih);
                                const docSnap = await getDoc(docRef);
                                if (docSnap.exists()) {
                                    window.tumProgramlar[window.aktifGrup] = docSnap.data();
                                    renderSchedule();
                                    document.getElementById('etkinTarihInput').value = tarih;
                                    guncelYukluVersiyonTarihi = tarih;
                                    document.getElementById('aktif-versiyon-bilgisi').textContent = `Şu an ${formatDateDDMMYYYY(tarih)} tarihli versiyonu düzenliyorsunuz.`;
                                    showToast(`${formatDateDDMMYYYY(tarih)} versiyonu yüklendi.`, 'info');
                                }
                            } else if (deleteButton) {
                                e.preventDefault();
                                const tarih = deleteButton.dataset.tarih;
                                deleteScheduleVersion(tarih);
                            }
                        });
                        versiyonListesiUL.dataset.listenerAttached = 'true';
                    }

                } catch (error) {
                    console.error("Versiyon listesi yüklenirken hata:", error);
                    versiyonListesiUL.innerHTML = '<li>Versiyonlar yüklenemedi.</li>';
                }
            }


            async function deleteScheduleVersion(tarih) {
                showConfirmationModal(
                    `<strong>${formatDateDDMMYYYY(tarih)}</strong> tarihli program versiyonu <strong>TÜM SINIFLARDAN</strong> kalıcı olarak silinecektir. Bu işlem geri alınamaz. Emin misiniz?`,
                    async () => {
                        showSpinner();
                        try {
                            const siniflarSnap = await getSettings('ayarlar_siniflar');
                            const anlikSinifListesi = siniflarSnap.docs.map(doc => doc.data().name);
                            if (anlikSinifListesi.length === 0) {
                                throw new Error("Veritabanında kayıtlı sınıf bulunamadığı için silme işlemi yapılamadı.");
                            }
                            const deletePromises = anlikSinifListesi.map(sinifAdi => {
                                const sanitizedSinifAdi = `${currentUserOkulId}_${sinifAdi.replace(/\//g, '-')}`;
                                const docRef = doc(db, "ders_programlari", sanitizedSinifAdi, "versiyonlar", tarih);
                                return deleteDoc(docRef);
                            });
                            await Promise.all(deletePromises);
                            showToast('Program versiyonu tüm sınıflardan başarıyla silindi.', 'success');
                            if (window.aktifGrup) {
                                await loadScheduleForClass(window.aktifGrup);
                                await renderYerlestirmeHavuzu();
                            }
                        } catch (error) {
                            console.error("!!! VERSİYON SİLME SIRASINDA KRİTİK HATA:", error);
                            showToast(`Silme işlemi başarısız oldu: ${error.message}`, 'error');
                        } finally {
                            hideSpinner();
                        }
                    }
                );
            }

            function generateTimeSlots() {
                dersSaatleri.length = 0;
                const baslangicSaatiStr = zamanCizelgesiAyarlari.dersBaslangic || '08:30';
                const toplamDers = parseInt(zamanCizelgesiAyarlari.toplamDers) || 8;
                const dersSuresi = parseInt(zamanCizelgesiAyarlari.dersSuresi) || 40;
                const teneffusSuresi = parseInt(zamanCizelgesiAyarlari.teneffusSuresi) || 10;
                const ogleArasiDersNo = parseInt(zamanCizelgesiAyarlari.ogleArasiDersNo) || 0;
                const ogleArasiSuresi = parseInt(zamanCizelgesiAyarlari.ogleArasiSuresi) || 45;
                const ozelTeneffusler = zamanCizelgesiAyarlari.ozelTeneffusler || [];
                let suankiZaman = new Date();
                const [saat, dakika] = baslangicSaatiStr.split(':');
                suankiZaman.setHours(parseInt(saat), parseInt(dakika), 0, 0);
                for (let i = 1; i <= toplamDers; i++) {
                    let baslangic = new Date(suankiZaman);
                    suankiZaman.setMinutes(suankiZaman.getMinutes() + dersSuresi);
                    let bitis = new Date(suankiZaman);
                    dersSaatleri.push({
                        dersNo: i,
                        baslangic: baslangic.toTimeString().substring(0, 5),
                        bitis: bitis.toTimeString().substring(0, 5)
                    });
                    if (i < toplamDers) {
                        let eklenecekMolaSuresi = 0;
                        if (i === ogleArasiDersNo) {
                            eklenecekMolaSuresi = ogleArasiSuresi;
                        } else {
                            const ozelTeneffus = ozelTeneffusler.find(t => parseInt(t.afterLesson) === i);
                            if (ozelTeneffus) {
                                eklenecekMolaSuresi = parseInt(ozelTeneffus.duration);
                            } else {
                                eklenecekMolaSuresi = teneffusSuresi;
                            }
                        }
                        if (eklenecekMolaSuresi > 0) {
                            suankiZaman.setMinutes(suankiZaman.getMinutes() + eklenecekMolaSuresi);
                        }
                    }
                }
                const saatSelectleri = [document.getElementById('saat'), document.getElementById('genel-bloke-saat'), document.getElementById('d-saat-select'), document.getElementById('edit-d-saat-select')];
                saatSelectleri.forEach(select => {
                    if (select) {
                        const mevcutDeger = select.value;
                        select.innerHTML = '';
                        dersSaatleri.forEach(slot => select.add(new Option(`${slot.dersNo}. Ders (${slot.baslangic}-${slot.bitis})`, slot.dersNo)));
                        select.value = mevcutDeger;
                    }
                });
                return Promise.resolve();
            }

            function deleteLesson(gun, dersNo) {
                if (window.tumProgramlar[window.aktifGrup]?.[gun]?.[dersNo]) { // 'dersNo' ile kontrol
                    delete window.tumProgramlar[window.aktifGrup][gun][dersNo]; // 'dersNo' ile silme
                    renderSchedule();
                    renderYerlestirmeHavuzu();
                    showToast('Ders kaldırıldı. Kaydetmeyi unutmayın.', 'info');
                }
            }
            async function addLesson(forceAdd = false) {
                const gun = document.getElementById('gun').value;
                const saatSelect = document.getElementById('saat');
                const ogretmenSelect = document.getElementById('ogretmen');
                const dersSelect = document.getElementById('dersAdi');
                const saatNo = parseInt(saatSelect.value);
                const ogretmenId = ogretmenSelect.value;
                const dersId = dersSelect.value;
                const ogretmenAdi = ogretmenSelect.options[ogretmenSelect.selectedIndex].text;
                const dersAdi = dersSelect.options[dersSelect.selectedIndex].text;
                const aktifSinif = window.aktifGrup;
                if (!ogretmenId || !dersId || !saatNo || !aktifSinif) {
                    return showToast('Lütfen Gün, Saat, Öğretmen ve Ders seçin.', 'error');
                }
                const ilgiliKural = window.dersKurallariListesi.find(kural =>
                    kural.dersId === dersId &&
                    kural.atananOgretmenId === ogretmenId &&
                    kural.seviye === aktifSinif
                );
                if (!ilgiliKural) {
                    return showToast('Bu Ders/Öğretmen/Sınıf kombinasyonu için "Ders (Branş) Kuralları"nda bir tanım bulunamadı. Lütfen önce kuralı oluşturun.', 'error');
                }
                const saatSlot = dersSaatleri.find(slot => slot.dersNo === saatNo); // Bu satır aynı kalabilir veya kaldırılabilir, saatNo zaten elimizde.
                if (!saatSlot) { // saatNo'nun geçerliliğini kontrol etmek yine de iyi olabilir
                    console.error("Seçilen ders saati için zaman dilimi bulunamadı:", saatNo);
                    return showToast('Geçersiz ders saati seçimi. Sayfayı yenileyin.', 'error');
                }
                if (!window.tumProgramlar[aktifSinif]) {
                    window.tumProgramlar[aktifSinif] = {};
                }
                if (!window.tumProgramlar[aktifSinif][gun]) {
                    window.tumProgramlar[aktifSinif][gun] = {};
                }
                window.tumProgramlar[aktifSinif][gun][saatNo] = { // baslangicSaati yerine saatNo kullanılıyor
                    ogretmen: ogretmenAdi,
                    dersAdi: dersAdi,
                    kuralId: ilgiliKural.id,
                    hasConflict: forceAdd // Çakışma kontrolü hala saate göre yapılabilir veya ders sırasına göre güncellenebilir. Şimdilik bırakıyoruz.
                };
                renderSchedule();
                showToast('Ders eklendi. Kaydetmeyi unutmayın.', 'info');
                renderYerlestirmeHavuzu(); // Havuz şimdi doğru hesaplanacak
            }

            async function runAutomaticScheduler() {
                showProgressModal();
                await new Promise(resolve => setTimeout(resolve, 50));
                try {
                    const [derslerSnap, siniflarSnap, personelSnap, dersKurallariSnap, ogretmenKurallariSnap, genelKurallarSnap] = await Promise.all([
                        getSettings('ayarlar_dersler'), getSettings('ayarlar_siniflar'),
                        getDocs(query(collection(db, 'personel'), where("okulId", "==", currentUserOkulId))),
                        getDocs(query(collection(db, 'ders_kurallari'), where("okulId", "==", currentUserOkulId))),
                        getDocs(query(collection(db, 'ogretmen_kurallari'), where("okulId", "==", currentUserOkulId))),
                        getDoc(doc(db, 'programlama_kurallari', currentUserOkulId))
                    ]);
                    const dataMaps = {
                        dersMap: new Map(derslerSnap.docs.map(d => [d.id, d.data().name])),
                        teacherMap: new Map(personelSnap.docs.map(d => [d.id, d.data().ad_soyad])),
                        ogretmenKurallari: new Map(ogretmenKurallariSnap.docs.map(d => [d.id, d.data()])),
                        genelKurallar: genelKurallarSnap.exists() ? genelKurallarSnap.data() : {}
                    };
                    const dersKuraliListesi = dersKurallariSnap.docs.map(d => ({ ...d.data(), id: d.id }));
                    const derslerBySinif = {};
                    dersKuraliListesi.forEach(kural => {
                        if (!derslerBySinif[kural.seviye]) derslerBySinif[kural.seviye] = [];
                        for (let i = 0; i < kural.haftalikSaat; i++) {
                            derslerBySinif[kural.seviye].push({ ...kural, instanceId: `${kural.id}_${i}` });
                        }
                    });
                    const siraliSiniflar = Object.keys(derslerBySinif).sort();
                    const toplamSinifSayisi = siraliSiniflar.length;
                    if (toplamSinifSayisi === 0) {
                        hideProgressModal();
                        return showToast('Yerleştirilecek ders kuralı bulunamadı.', 'error');
                    }
                    let programTaslagi = {};
                    let tumDerslerYerlesti = false;
                    const maxRetries = 3;
                    let retryCount = 0;
                    const classTimeout = 10000;
                    while (retryCount < maxRetries && !tumDerslerYerlesti) {
                        retryCount++;
                        tumDerslerYerlesti = true;
                        programTaslagi = {};
                        const isRetry = retryCount > 1;
                        if (isRetry) {
                            const suggestionBox = document.getElementById('progress-suggestion-text');
                            suggestionBox.innerHTML = `⚠️ Yerleştirme takıldı, farklı bir strateji deneniyor... (Deneme ${retryCount}/${maxRetries})`;
                            suggestionBox.style.display = 'block';
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        }
                        for (let i = 0; i < toplamSinifSayisi; i++) {
                            const sinifAdi = siraliSiniflar[i];
                            const sinifDersleri = [...derslerBySinif[sinifAdi]];
                            if (isRetry) {
                                shuffleArray(sinifDersleri);
                            }
                            programTaslagi[sinifAdi] = {};
                            const percentage = Math.round(((i) / toplamSinifSayisi) * 100);
                            updateProgress(percentage, `${sinifAdi} sınıfının dersleri yerleştiriliyor...`);
                            document.getElementById('progress-suggestion-text').style.display = 'none';
                            try {
                                const timeoutPromise = new Promise((_, reject) =>
                                    setTimeout(() => reject(new Error('Timeout')), classTimeout)
                                );
                                const result = await Promise.race([
                                    solveScheduler(programTaslagi, sinifDersleri, dataMaps, isRetry),
                                    timeoutPromise
                                ]);
                                if (!result.success) {
                                    tumDerslerYerlesti = false;
                                    const suggestion = generateSuggestion(result.diagnostics, dataMaps);
                                    const suggestionBox = document.getElementById('progress-suggestion-text');
                                    suggestionBox.innerHTML = suggestion;
                                    suggestionBox.style.display = 'block';
                                    console.warn(`${sinifAdi} için yerleştirme başarısız (Deneme ${retryCount}). Rapor:`, result.diagnostics);
                                    await new Promise(resolve => setTimeout(resolve, 4000));
                                    break;
                                }
                            } catch (error) {
                                if (error.message === 'Timeout') {
                                    tumDerslerYerlesti = false;
                                    const suggestionBox = document.getElementById('progress-suggestion-text');
                                    suggestionBox.innerHTML = `⚠️ <strong>${sinifAdi}</strong> sınıfı için çözüm bulunması çok uzun sürdü (zaman aşımı).`;
                                    suggestionBox.style.display = 'block';
                                    console.warn(`${sinifAdi} için yerleştirme zaman aşımına uğradı (Deneme ${retryCount}).`);
                                    await new Promise(resolve => setTimeout(resolve, 4000));
                                    break;
                                } else {
                                    throw error;
                                }
                            }
                        }
                    }
                    updateProgress(100, 'Program tamamlandı! Son kontroller yapılıyor...');
                    window.tumProgramlar = programTaslagi;
                    renderSchedule();
                    await renderYerlestirmeHavuzu();
                    setTimeout(() => {
                        hideProgressModal();
                        showToast(tumDerslerYerlesti ? 'Tüm dersler başarıyla yerleştirildi!' : `Otomatik yerleştirme ${maxRetries} deneme sonunda tamamlandı. Bazı dersler yerleştirilemedi.`, tumDerslerYerlesti ? 'success' : 'info');
                    }, 1000);

                } catch (error) {
                    hideProgressModal();
                    console.error("!!! OTOMATİK DOLDURMA SIRASINDA KRİTİK HATA:", error);
                    showToast(`Program oluşturulurken bir hata meydana geldi.`, 'error');
                }
            }




            function generateSuggestion(diagnostics, dataMaps) {
                if (!diagnostics) return "Bilinmeyen bir sorun nedeniyle yerleştirme yapılamadı.";
                const { lesson, reasons } = diagnostics;
                const dersAdi = dataMaps.dersMap.get(lesson.dersId);
                const ogretmenAdi = dataMaps.teacherMap.get(lesson.atananOgretmenId);
                const reasonCounts = {};
                reasons.forEach(r => {
                    reasonCounts[r.reason] = (reasonCounts[r.reason] || 0) + 1;
                });
                let maxReason = 'UNKNOWN';
                let maxCount = 0;
                for (const reason in reasonCounts) {
                    if (reasonCounts[reason] > maxCount) {
                        maxCount = reasonCounts[reason];
                        maxReason = reason;
                    }
                }
                let suggestion = `⚠️ <strong>${lesson.seviye}</strong> sınıfının <strong>${dersAdi}</strong> dersi yerleştirilemiyor.<br>`;
                switch (maxReason) {
                    case 'TEACHER_CONFLICT':
                        suggestion += `<strong>En sık karşılaşılan sorun:</strong> Öğretmen <strong>${ogretmenAdi}</strong>'in programının dolu olması.<br>
                           <strong>Öneri:</strong> Bu dersi başka bir öğretmene atamayı veya öğretmenin programındaki diğer derslerin yerini değiştirmeyi deneyin.`;
                        break;
                    case 'TEACHER_RULE_BLOCKED':
                        suggestion += `<strong>En sık karşılaşılan sorun:</strong> Öğretmen <strong>${ogretmenAdi}</strong>'in kişisel programındaki kısıtlamalar.<br>
                           <strong>Öneri:</strong> 'Ayarlar > Öğretmen Kuralları' menüsünden <strong>${ogretmenAdi}</strong> için "Kesinlikle Boş" olarak işaretlenmiş saatleri kontrol edin veya esnetin.`;
                        break;
                    case 'GLOBAL_RULE_BLOCKED':
                        suggestion += `<strong>En sık karşılaşılan sorun:</strong> Dersin yerleşebileceği saatlerin genel kurallarla (tören vb.) bloke edilmiş olması.<br>
                           <strong>Öneri:</strong> 'Ayarlar > Genel Kurallar' menüsündeki "Genel Bloke Zamanlar"ı kontrol edin.`;
                        break;
                    default:
                        suggestion += `<strong>Sorun:</strong> Ders için uygun bir zaman dilimi bulunamadı. Muhtemelen birçok kuralın (öğretmen yoğunluğu, derslik ihtiyacı vb.) birleşimi buna neden oluyor.<br>
                           <strong>Öneri:</strong> İlgili öğretmen ve sınıfın kurallarını gözden geçirin.`;
                }

                return suggestion;
            }


            async function solveScheduler(schedule, derslerToPlace, dataMaps, shouldRandomize = false) {
                if (derslerToPlace.length === 0) {
                    return { success: true };
                }
                await new Promise(resolve => setTimeout(resolve, 0));
                const ders = derslerToPlace[0];
                const kalanDersler = derslerToPlace.slice(1);
                const sinifAdi = ders.seviye;
                const gunler = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
                const saatSlots = [...dersSaatleri]; // Kopyasını al
                if (shouldRandomize) {
                    shuffleArray(gunler);
                    shuffleArray(saatSlots);
                }
                const failureReasons = [];
                for (const gun of gunler) {
                    for (const saatSlot of saatSlots) {
                        const saatNo = saatSlot.dersNo; // Ders no alınıyor
                        const validationResult = isPlacementValid(schedule, ders, sinifAdi, gun, saatNo, dataMaps); // Sadece saatNo gönderiliyor
                        if (validationResult.isValid) {
                            if (!schedule[sinifAdi]) schedule[sinifAdi] = {}; // Bu kontroller kalmalı
                            if (!schedule[sinifAdi][gun]) schedule[sinifAdi][gun] = {}; // Bu kontroller kalmalı
                            schedule[sinifAdi][gun][saatNo] = { // saatNo anahtar
                                ogretmen: dataMaps.teacherMap.get(ders.atananOgretmenId),
                                dersAdi: dataMaps.dersMap.get(ders.dersId),
                                kuralId: ders.id
                            };
                            const result = await solveScheduler(schedule, kalanDersler, dataMaps, shouldRandomize);
                            if (result.success) {
                                return { success: true };
                            }
                            delete schedule[sinifAdi][gun][saatNo]; // saatNo ile siliniyor
                        } else {
                            failureReasons.push({ ...validationResult, day: gun, hour: saatNo });
                        }
                    }
                }
                return { success: false, diagnostics: { lesson: ders, reasons: failureReasons } };
            }


            function isPlacementValid(schedule, ders, sinifAdi, gun, saatNo, dataMaps) {
                const { teacherMap, ogretmenKurallari, genelKurallar } = dataMaps;
                const ogretmenId = ders.atananOgretmenId;
                const ogretmenAdi = teacherMap.get(ogretmenId);
                if (schedule[sinifAdi]?.[gun]?.[saatNo]) {
                    return { isValid: false, reason: 'CLASS_CELL_OCCUPIED' };
                }

                for (const s in schedule) {
                    if (s === sinifAdi) continue;
                    if (schedule[s]?.[gun]?.[saatNo]?.ogretmen === ogretmenAdi) {
                        return { isValid: false, reason: 'TEACHER_CONFLICT', details: { teacher: ogretmenAdi, conflictingClass: s } };
                    }
                }

                if (genelKurallar.blokeZamanlar?.some(z => z.gun === gun && parseInt(z.saat) === saatNo)) {
                    return { isValid: false, reason: 'GLOBAL_RULE_BLOCKED', details: { day: gun, hour: saatNo } };
                }

                const kural = ogretmenKurallari.get(ogretmenId);
                if (kural?.zamanPlanlari?.[`cell-${gun}-${saatNo}`] === 'kesinlikle-bos') {
                    return { isValid: false, reason: 'TEACHER_RULE_BLOCKED', details: { teacher: ogretmenAdi, day: gun, hour: saatNo } };
                }

                return { isValid: true };
            }


            async function renderYerlestirmeHavuzu() {
                const havuzContainer = document.getElementById('yerlestirme-havuzu-container');
                if (!havuzContainer) return;
                havuzContainer.innerHTML = '<p>Havuz hesaplanıyor...</p>';

                try {
                    const dersKurallari = window.dersKurallariListesi || [];
                    const [derslerSnap, personelSnap, siniflarSnap] = await Promise.all([
                        getSettings('ayarlar_dersler'),
                        getDocs(query(collection(db, 'personel'), where("okulId", "==", currentUserOkulId))),
                        getSettings('ayarlar_siniflar')
                    ]);
                    const dersMap = new Map(derslerSnap.docs.map(d => [d.id, d.data().name]));
                    const teacherMap = new Map(personelSnap.docs.map(d => [d.id, d.data().ad_soyad]));
                    const localClassList = siniflarSnap.docs.map(d => d.data().name);
                    const yerlesmisDersSayaci = {};
                    for (const sinifAdi in window.tumProgramlar) {
                        if (!localClassList.includes(sinifAdi)) continue;
                        for (const gun in window.tumProgramlar[sinifAdi]) {
                            for (const saat in window.tumProgramlar[sinifAdi][gun]) {
                                const dersData = window.tumProgramlar[sinifAdi][gun][saat];
                                if (dersData && dersData.kuralId) {
                                    const key = dersData.kuralId;
                                    yerlesmisDersSayaci[key] = (yerlesmisDersSayaci[key] || 0) + 1;
                                }
                            }
                        }
                    }
                    const selectedClass = document.getElementById('grup-secim-dropdown').value;
                    const isClassView = document.getElementById('sinif-gorunum-btn').classList.contains('active');
                    let havuzDolu = false;
                    havuzContainer.innerHTML = '';
                    dersKurallari.forEach(kural => {
                        const kuralinSinifi = kural.seviye;
                        if (isClassView && kuralinSinifi !== selectedClass) {
                            return;
                        }
                        const kuralId = kural.id; // Her kuralın benzersiz Firestore ID'si
                        const gerekenSaat = parseInt(kural.haftalikSaat) || 0;
                        const yerlesmisSaat = yerlesmisDersSayaci[kuralId] || 0;
                        const kalanSaat = gerekenSaat - yerlesmisSaat;
                        if (kalanSaat > 0) {
                            havuzDolu = true;
                            const dersAdi = dersMap.get(kural.dersId) || 'Bilinmeyen Ders';
                            const ogretmenAdi = teacherMap.get(kural.atananOgretmenId) || 'Otomatik';
                            const havuzItem = document.createElement('div');
                            havuzItem.className = 'havuz-item';
                            havuzItem.draggable = true;
                            havuzItem.innerHTML = `<div><strong>${dersAdi}</strong><small style="color:#555;">(${kuralinSinifi} / ${ogretmenAdi})</small></div><span class="kalan-saat">${kalanSaat}</span>`;
                            havuzItem.dataset.kuralId = kuralId;
                            havuzItem.dataset.dersAdi = dersAdi;
                            havuzItem.dataset.ogretmenAdi = ogretmenAdi;
                            havuzItem.dataset.sinifAdi = kuralinSinifi;
                            havuzItem.addEventListener('dragstart', (e) => { e.target.classList.add('dragging'); e.dataTransfer.setData('application/json', JSON.stringify({ dersAdi: e.target.dataset.dersAdi, ogretmenAdi: e.target.dataset.ogretmenAdi, sinifAdi: e.target.dataset.sinifAdi, kuralId: e.target.dataset.kuralId })); });
                            havuzItem.addEventListener('dragend', (e) => e.target.classList.remove('dragging'));
                            havuzContainer.appendChild(havuzItem);
                        }
                    });
                    if (!havuzDolu) {
                        const message = (isClassView && selectedClass)
                            ? `<p style="text-align:center; color:green; font-weight:bold;">'${selectedClass}' sınıfının tüm dersleri yerleştirilmiş!</p>`
                            : `<p style="text-align:center;">Yerleştirilecek ders bulunmuyor.</p>`;
                        havuzContainer.innerHTML = message;
                    }
                } catch (error) {
                    console.error("Yerleştirme havuzu oluşturulurken hata:", error);
                    havuzContainer.innerHTML = '<p style="color:red;">Havuz yüklenemedi.</p>';
                }
            }

            function attachDragDropListeners() {
                const cells = document.querySelectorAll('#schedule-display-area .schedule-table td');
                cells.forEach(cell => {
                    cell.addEventListener('dragover', (e) => {
                        e.preventDefault();
                        const sinifGorunumuAktif = document.getElementById('sinif-gorunum-btn').classList.contains('active');
                        if (sinifGorunumuAktif) {
                            e.currentTarget.classList.add('drag-over');
                        }
                    });
                    cell.addEventListener('dragleave', (e) => {
                        e.currentTarget.classList.remove('drag-over');
                    });
                    cell.addEventListener('drop', async (e) => {
                        e.preventDefault();
                        e.currentTarget.classList.remove('drag-over');
                        const sinifGorunumuAktif = document.getElementById('sinif-gorunum-btn').classList.contains('active');
                        if (!sinifGorunumuAktif) {
                            return;
                        }
                        const data = JSON.parse(e.dataTransfer.getData('application/json'));

                        if (data.sinifAdi !== window.aktifGrup) {
                            return;
                        }
                        const gun = e.currentTarget.dataset.gun;
                        const dersNo = parseInt(e.currentTarget.dataset.dersNo); // dersNo alınıyor
                        if (!dersNo) {
                            console.error("Bırakılan hücrenin ders numarası alınamadı.");
                            return; // Hata durumunda işlemi durdur
                        }
                        if (!window.tumProgramlar[data.sinifAdi]) window.tumProgramlar[data.sinifAdi] = {};
                        if (!window.tumProgramlar[data.sinifAdi][gun]) window.tumProgramlar[data.sinifAdi][gun] = {};

                        const dersObjesi = {
                            ogretmen: data.ogretmenAdi,
                            dersAdi: data.dersAdi,
                            kuralId: data.kuralId
                        };
                        window.tumProgramlar[data.sinifAdi][gun][dersNo] = dersObjesi; // dersNo anahtar olarak kullanılıyor

                        await renderYerlestirmeHavuzu();
                        renderSchedule();

                        showToast('Ders programa eklendi. Kaydetmeyi unutmayın.', 'info');
                    });
                });
            }
            let geciciDetaylar = [];
            let duzenlenenGorevDetaylari = [];
            let gorevlendirmeInitialized = false;
            // YUKARIDAKİ BLOĞUN YERİNE BU BLOĞU YAPIŞTIRIN

            async function populateOgretmenSelectsForGorevlendirme() {
                // 1. Tüm potansiyel element referanslarını al. Hata vermez, olmayanlar null olur.
                const gAsilOgretmen = document.getElementById('g-asil-ogretmen');
                const gGorevliOgretmen = document.getElementById('g-gorevli-ogretmen'); // Bu null olacak
                const editAsilOgretmen = document.getElementById('edit-g-asil-ogretmen');
                const editGorevliOgretmen = document.getElementById('edit-g-gorevli-ogretmen');

                // 2. Sadece var olan (null olmayan) elementlerden bir liste oluştur
                const allSelects = [gAsilOgretmen, gGorevliOgretmen, editAsilOgretmen, editGorevliOgretmen];
                const foundSelects = allSelects.filter(sel => sel !== null);

                // 3. Eğer doldurulacak hiçbir liste bulunamadıysa fonksiyonu durdur.
                if (foundSelects.length === 0) {
                    console.error("Görevlendirme için hiçbir öğretmen select elementi bulunamadı.");
                    return;
                }

                // 4. Sadece bulunan listelere "Yükleniyor..." mesajını koy
                foundSelects.forEach(sel => {
                    sel.innerHTML = '<option value="">Yükleniyor...</option>';
                });

                try {
                    // Gerekli verileri paralel olarak çek
                    const [personelSnap, neviSnap, gorevSnap] = await Promise.all([
                        getDocs(query(collection(db, 'personel'), where("okulId", "==", currentUserOkulId))),
                        getSettings('ayarlar_personel_nevileri'),
                        getSettings('ayarlar_gorevler')
                    ]);

                    console.log("Veritabanından çekilen personel sayısı:", personelSnap.docs.length);

                    // Nevi ve görev ID'lerini haritala
                    const egitimPersoneliNevi = neviSnap.docs.find(doc => doc.data().name.includes('Eğitim Personeli'));
                    const egitimPersoneliNeviId = egitimPersoneliNevi ? egitimPersoneliNevi.id : null;
                    const idariGorevler = new Set();
                    gorevSnap.forEach(doc => {
                        const gorevAdi = doc.data().name.toLowerCase();
                        if (gorevAdi.includes('müdür') || gorevAdi.includes('rehber öğretmen')) {
                            idariGorevler.add(doc.id);
                        }
                    });

                    // Görevlendirme için uygun personelleri filtrele
                    const gosterilecekPersoneller = [];
                    const bugun = new Date(); // Aktiflik kontrolü için
                    bugun.setHours(0, 0, 0, 0);
                    personelSnap.forEach(doc => {
                        const personel = { id: doc.id, ...doc.data() };
                        const isEgitimPersoneli = personel.personel_nevisi === egitimPersoneliNeviId;
                        const isIdariGorevli = idariGorevler.has(personel.gorevi_bransi);
                        const ayrilisTarihi = personel.isten_ayrilis ? new Date(personel.isten_ayrilis) : null;
                        const isActive = !ayrilisTarihi || ayrilisTarihi > bugun; // Ayrılmamış veya gelecekte ayrılacak

                        if ((isEgitimPersoneli || isIdariGorevli) && isActive) { // Sadece aktif personeli ekle
                            gosterilecekPersoneller.push(personel);
                        }
                    });

                    console.log("Filtreleme sonrası gösterilecek personel sayısı:", gosterilecekPersoneller.length);
                    gosterilecekPersoneller.sort((a, b) => a.ad_soyad.localeCompare(b.ad_soyad, 'tr'));

                    // 5. Sadece bulunan listelerin içeriğini temizle
                    foundSelects.forEach(sel => {
                        sel.innerHTML = '<option value="">Seçiniz...</option>';
                    });

                    // 6. Sadece bulunan listelere seçenekleri ekle
                    gosterilecekPersoneller.forEach(p => {
                        const option = new Option(p.ad_soyad, p.id);
                        foundSelects.forEach(sel => {
                            sel.add(option.cloneNode(true));
                        });
                    });

                    // Kalan (yorum satırlı) kodda bir değişiklik yok...

                } catch (e) {
                    console.error("Görevlendirilecek öğretmenler yüklenemedi:", e);
                    showToast('Öğretmen listesi yüklenemedi.', 'error');
                    // 7. Hata durumunda sadece bulunan listeleri güncelle
                    foundSelects.forEach(sel => {
                        sel.innerHTML = '<option value="">Hata!</option>';
                    });
                }
            }


            // ✅ YENİ FONKSİYONU EKLEYİN (Genel scope'a veya initializeGorevlendirme'den önce)

            // Küresel veya modül kapsamında öğretmen kurallarını ve görevlendirmeleri önbelleğe almak için:
            let teacherRulesCache = null;
            let assignmentsCache = {}; // Tarihe göre gruplanmış görevlendirmeler

            // Belirli bir tarih aralığı için görevlendirmeleri önbelleğe alan fonksiyon
            async function cacheAssignmentsForDates(startDateStr, endDateStr) {
                assignmentsCache = {}; // Önbelleği temizle
                try {
                    const q = query(collection(db, 'ders_gorevlendirmeleri'),
                        where("okulId", "==", currentUserOkulId),
                        where("tarih", ">=", startDateStr),
                        where("tarih", "<=", endDateStr));
                    const snapshot = await getDocs(q);
                    snapshot.forEach(doc => {
                        const assignment = doc.data();
                        if (!assignmentsCache[assignment.tarih]) {
                            assignmentsCache[assignment.tarih] = [];
                        }
                        assignmentsCache[assignment.tarih].push(assignment);
                    });
                } catch (error) {
                    console.error("Görevlendirme önbelleği oluşturulurken hata:", error);
                }
            }

            // Öğretmen kurallarını önbelleğe alan fonksiyon
            async function cacheTeacherRules() {
                if (teacherRulesCache) return; // Zaten yüklendiyse tekrar yükleme
                teacherRulesCache = new Map();
                try {
                    const snapshot = await getDocs(query(collection(db, 'ogretmen_kurallari'), where("okulId", "==", currentUserOkulId)));
                    snapshot.forEach(doc => {
                        teacherRulesCache.set(doc.id, doc.data());
                    });
                } catch (error) {
                    console.error("Öğretmen kuralları önbelleği oluşturulurken hata:", error);
                    teacherRulesCache = new Map(); // Hata durumunda boş harita kullan
                }
            }


            /**
             * Belirtilen tarih ve ders numarası için müsait bir öğretmen bulur.
             * @param {string} tarihStr - YYYY-MM-DD formatında tarih.
             * @param {number} dersNo - Dersin sıra numarası (1, 2, ...).
             * @param {string} asilOgretmenId - Görevlendirilecek asıl öğretmenin ID'si (kendisine atanmaması için).
             * @param {Array} allTeachers - Tüm potansiyel öğretmenlerin listesi [{id: '...', ad_soyad: '...', ...}].
             * @returns {string|null} - Müsait öğretmenin ID'sini veya null döner.
             */
            // YUKARIDA SİLDİĞİNİZ FONKSİYONUN YERİNE BUNU YAPIŞTIRIN

            /**
             * Belirtilen ders için müsait öğretmenleri puanlayarak listeler.
             * @param {string} tarihStr - YYYY-MM-DD formatında tarih.
             * @param {number} dersNo - Dersin sıra numarası.
             * @param {string} dersBransAdi - Dersin adı (örn: "Matematik").
             * @param {string} asilOgretmenId - Görevlendirilecek asıl öğretmenin ID'si.
             * @param {Array} allPotentialTeachers - Tüm potansiyel öğretmenlerin listesi.
             * @param {Map} gorevMap - Görev ID'lerini görev adlarına çeviren harita.
             * @returns {Array} - Müsait öğretmenlerin puanlarına göre sıralanmış listesi. [{id, ad_soyad, score, bransName}]
             */
            async function getAvailableTeachers(tarihStr, dersNo, dersBransAdi, asilOgretmenId, allPotentialTeachers, gorevMap) {
                const gunlerTR = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
                const tarih = new Date(tarihStr + 'T00:00:00Z');
                const gunAdi = gunlerTR[tarih.getUTCDay()];

                // Kuralları ve görevlendirmeleri önbelleğe al (eğer henüz alınmadıysa)
                await cacheTeacherRules();
                await cacheAssignmentsForDates(tarihStr, tarihStr); // Sadece o günü önbelleğe al

                const availableTeachers = [];

                for (const teacher of allPotentialTeachers) {
                    if (teacher.id === asilOgretmenId) continue; // Asıl öğretmeni atla

                    const teacherId = teacher.id;
                    const teacherName = teacher.ad_soyad;
                    const teacherBransId = teacher.gorevi_bransi;
                    const teacherBransName = gorevMap.get(teacherBransId) || '';

                    // 1. Öğretmenin ders programında o saatte dersi var mı?
                    let hasScheduledClass = false;
                    if (window.tumProgramlar) {
                        for (const sinifKey in window.tumProgramlar) {
                            const dersData = window.tumProgramlar[sinifKey]?.[gunAdi]?.[dersNo];
                            if (dersData && dersData.ogretmen === teacherName) {
                                hasScheduledClass = true;
                                break;
                            }
                        }
                    }
                    if (hasScheduledClass) continue;

                    // 2. Öğretmenin o gün/saat için başka bir görevlendirmesi var mı?
                    let hasOtherAssignment = false;
                    const todaysAssignments = assignmentsCache[tarihStr] || [];
                    for (const assignment of todaysAssignments) {
                        // GörevliId (ana) veya detaylardaki görevliId kontrol ediliyor
                        const isAssigned = (assignment.gorevliId === teacherId ||
                            (assignment.detaylar && assignment.detaylar.some(d => d.gorevliId === teacherId && d.saat === dersNo)));

                        if (isAssigned && assignment.detaylar && assignment.detaylar.some(d => d.saat === dersNo)) {
                            hasOtherAssignment = true;
                            break;
                        }
                    }
                    if (hasOtherAssignment) continue;

                    // 3. Öğretmenin kişisel kuralı "Kesinlikle Boş" mu?
                    const teacherRule = teacherRulesCache ? teacherRulesCache.get(teacherId) : null;
                    const cellId = `cell-${gunAdi}-${dersNo}`;
                    if (teacherRule?.zamanPlanlari?.[cellId] === 'kesinlikle-bos') {
                        continue;
                    }

                    // Müsait bulundu, şimdi puanlama yap
                    let score = 2; // Puan +2 (Diğer Öğretmen)

                    // Puan +8 (Aynı Branş)
                    if (teacherBransName && dersBransAdi && teacherBransName === dersBransAdi) {
                        score = 8;
                    }

                    availableTeachers.push({
                        id: teacherId,
                        ad_soyad: teacherName,
                        bransName: teacherBransName,
                        score: score
                    });
                }

                // Listeyi önce puana (yüksekten düşüğe), sonra isme göre sırala
                availableTeachers.sort((a, b) => {
                    if (a.score !== b.score) {
                        return b.score - a.score; // Önce puana göre (büyükten küçüğe)
                    }
                    return a.ad_soyad.localeCompare(b.ad_soyad, 'tr'); // Puanlar eşitse isme göre
                });

                return availableTeachers;
            }

            // YUKARIDA SİLDİĞİNİZ FONKSİYONUN YERİNE BUNU YAPIŞTIRIN

            async function initializeGorevlendirme() {
                if (gorevlendirmeInitialized) {
                    // ... (Mevcut 'if (gorevlendirmeInitialized)' bloğu aynı kalıyor) ...
                    const asilOgretmenSelect = document.getElementById('g-asil-ogretmen');
                    const filterAsilSelect = document.getElementById('filter-g-asil');
                    const filterGorevliSelect = document.getElementById('filter-g-gorevli');

                    if (asilOgretmenSelect && filterAsilSelect && filterGorevliSelect && filterAsilSelect.options.length <= 1) {
                        filterAsilSelect.innerHTML = '<option value="">Tümü</option>';
                        filterGorevliSelect.innerHTML = '<option value="">Tümü</option>';
                        Array.from(asilOgretmenSelect.options).forEach(opt => {
                            if (opt.value && opt.value !== "Yükleniyor...") {
                                filterAsilSelect.add(opt.cloneNode(true));
                                filterGorevliSelect.add(opt.cloneNode(true));
                            }
                        });
                    }
                    return;
                }

                showSpinner();

                const gTarihInput = document.getElementById('g-tarih');
                if (gTarihInput) {
                    gTarihInput.valueAsDate = new Date();
                }

                const gKaydetBtn = document.getElementById('g-kaydet-btn');
                const gManuelAtaBtn = document.getElementById('g-manuel-ata-btn');
                const gManuelKaydetBtn = document.getElementById('g-manuel-kaydet-btn');

                const gorevlendirmeTbody = document.getElementById('gorevlendirme-tbody');
                const yazdirBtn = document.getElementById('btn-gorev-yazdir');

                // YENİ: Edit Modal'daki yeni ders listesi konteyneri
                const editDersListesiContainer = document.getElementById('edit-g-ders-listesi-container');

                const editForm = document.getElementById('editGorevlendirmeForm');
                const editModal = document.getElementById('edit-gorevlendirme-modal');
                const closeModalBtn = editModal?.querySelector('.close-modal');
                const applyFilterBtn = document.getElementById('apply-gorevlendirme-filter-btn');
                const clearFilterBtn = document.getElementById('clear-gorevlendirme-filter-btn');
                const filterAsilSelect = document.getElementById('filter-g-asil');
                const filterGorevliSelect = document.getElementById('filter-g-gorevli');

                const gAsilOgretmenSelect = document.getElementById('g-asil-ogretmen');
                if (gTarihInput && !gTarihInput.dataset.listenerAttached) {
                    gTarihInput.addEventListener('change', loadAbsentTeacherSchedule);
                    gTarihInput.dataset.listenerAttached = 'true';
                }
                if (gAsilOgretmenSelect && !gAsilOgretmenSelect.dataset.listenerAttached) {
                    gAsilOgretmenSelect.addEventListener('change', loadAbsentTeacherSchedule);
                    gAsilOgretmenSelect.dataset.listenerAttached = 'true';
                }

                try {
                    await populateOgretmenSelectsForGorevlendirme();

                    const asilOgretmenSelect = document.getElementById('g-asil-ogretmen');
                    if (asilOgretmenSelect && filterAsilSelect && filterGorevliSelect) {
                        filterAsilSelect.innerHTML = '<option value="">Tümü</option>';
                        filterGorevliSelect.innerHTML = '<option value="">Tümü</option>';
                        Array.from(asilOgretmenSelect.options).forEach(opt => {
                            if (opt.value && opt.value !== "Yükleniyor...") {
                                filterAsilSelect.add(opt.cloneNode(true));
                                filterGorevliSelect.add(opt.cloneNode(true));
                            }
                        });
                    } else {
                        console.warn("Filtre veya ana öğretmen select elementleri bulunamadı!");
                    }

                    // Ana form buton listener'ları
                    if (gKaydetBtn) gKaydetBtn.addEventListener('click', addGorevlendirme);
                    if (gManuelAtaBtn) gManuelAtaBtn.addEventListener('click', activateManualAssignmentMode);
                    if (gManuelKaydetBtn) gManuelKaydetBtn.addEventListener('click', addGorevlendirmeManuel);
                    if (yazdirBtn) yazdirBtn.addEventListener('click', () => window.print());

                    // Tablo listener'ı
                    if (gorevlendirmeTbody && !gorevlendirmeTbody.dataset.listenerAttached) {
                        gorevlendirmeTbody.addEventListener('click', async (e) => {
                            const target = e.target.closest('button');
                            if (!target || !target.dataset.id) return;
                            const id = target.dataset.id;
                            if (target.classList.contains('btn-delete-gorev')) {
                                showConfirmationModal(
                                    'Bu görevlendirme kaydını silmek istediğinizden emin misiniz?',
                                    async () => {
                                        await deleteDoc(doc(db, 'ders_gorevlendirmeleri', id));
                                        showToast('Görevlendirme başarıyla silindi.');
                                        await renderGorevlendirmeTable();
                                    },
                                    'Evet, Sil',
                                    'delete'
                                );
                            }
                            if (target.classList.contains('btn-edit-gorev')) {
                                openEditGorevlendirmeModal(id);
                            }
                        });
                        gorevlendirmeTbody.dataset.listenerAttached = 'true';
                    }

                    // YENİ: Edit modal listener'ları
                    // Eski 'edit-g-detay-ekle-btn' ve 'edit-g-detay-listesi' listener'ları kaldırıldı

                    // "Değiştir" butonlarını yönetmek için
                    if (editDersListesiContainer && !editDersListesiContainer.dataset.listenerAttached) {
                        editDersListesiContainer.addEventListener('click', handleChangeGorevliClick);
                        editDersListesiContainer.dataset.listenerAttached = 'true';
                    }

                    // Ana "Kaydet" butonu için
                    if (editForm && !editForm.dataset.listenerAttached) {
                        editForm.addEventListener('submit', saveGorevlendirmeChanges);
                        editForm.dataset.listenerAttached = 'true';
                    }

                    // Kalan listener'lar (Modal kapatma, filtreler vb.)
                    if (closeModalBtn && !closeModalBtn.dataset.listenerAttached) {
                        closeModalBtn.addEventListener('click', () => {
                            editModal.classList.remove('open');
                        });
                        closeModalBtn.dataset.listenerAttached = 'true';
                    }
                    if (applyFilterBtn && !applyFilterBtn.dataset.listenerAttached) {
                        applyFilterBtn.addEventListener('click', renderGorevlendirmeTable);
                        applyFilterBtn.dataset.listenerAttached = 'true';
                    }
                    if (clearFilterBtn && !clearFilterBtn.dataset.listenerAttached) {
                        clearFilterBtn.addEventListener('click', () => {
                            document.getElementById('filter-g-baslangic').value = '';
                            document.getElementById('filter-g-bitis').value = '';
                            document.getElementById('filter-g-asil').value = '';
                            document.getElementById('filter-g-gorevli').value = '';
                            document.getElementById('filter-g-neden').value = '';
                            renderGorevlendirmeTable();
                        });
                        clearFilterBtn.dataset.listenerAttached = 'true';
                    }

                    await renderGorevlendirmeTable();
                    gorevlendirmeInitialized = true;

                    await loadAbsentTeacherSchedule();

                } catch (error) {
                    console.error("Görevlendirme modülü başlatılırken hata:", error);
                    showToast("Görevlendirme modülü yüklenirken bir hata oluştu.", "error");
                    const gorevlendirmeTbody = document.getElementById('gorevlendirme-tbody');
                    if (gorevlendirmeTbody) gorevlendirmeTbody.innerHTML = `<tr><td colspan="8" style="color:red;">Modül yüklenemedi.</td></tr>`;
                } finally {
                    hideSpinner();
                }
            }

            async function renderGorevlendirmeTable() {
                const gTbody = document.getElementById('gorevlendirme-tbody');
                if (!gTbody) {
                    console.error("Görevlendirme tablosu body elementi bulunamadı!");
                    return;
                }
                gTbody.innerHTML = `<tr><td colspan="8">Görevlendirmeler yükleniyor...</td></tr>`;

                // --- Null Checks Eklendi ---
                const filterBaslangicEl = document.getElementById('filter-g-baslangic');
                const filterBitisEl = document.getElementById('filter-g-bitis');
                const filterAsilEl = document.getElementById('filter-g-asil'); // Elementi al
                const filterGorevliEl = document.getElementById('filter-g-gorevli');
                const filterNedenEl = document.getElementById('filter-g-neden');

                // Değerleri okumadan önce elementin varlığını kontrol et
                const filterBaslangic = filterBaslangicEl ? filterBaslangicEl.value : '';
                const filterBitis = filterBitisEl ? filterBitisEl.value : '';
                const filterAsilId = filterAsilEl ? filterAsilEl.value : ''; // Element varsa değerini al
                const filterGorevliId = filterGorevliEl ? filterGorevliEl.value : '';
                const filterNeden = filterNedenEl ? filterNedenEl.value : '';
                // --- Null Checks Sonu ---

                // Hata ayıklama için: Filtre elementlerinin bulunup bulunmadığını kontrol et
                if (!filterAsilEl) {
                    console.warn("Filtreleme için 'filter-g-asil' elementi bulunamadı. HTML'i kontrol edin.");
                    // İsteğe bağlı olarak burada fonksiyonu durdurabilir veya devam edebilirsiniz.
                    // return;
                }


                try {
                    let q = query(collection(db, 'ders_gorevlendirmeleri'),
                        where("okulId", "==", currentUserOkulId),
                        orderBy("tarih", "desc"));

                    // Firestore sorgu filtreleri (filterAsilId boşsa bile çalışır)
                    if (filterBaslangic) {
                        q = query(q, where("tarih", ">=", filterBaslangic));
                    }
                    if (filterAsilId) { // Sadece ID varsa filtrele
                        q = query(q, where("asilId", "==", filterAsilId));
                    }
                    // YUKARIDAKİ BLOĞUN YERİNE BUNU YAPIŞTIRIN
                    if (filterGorevliId) {
                        q = query(q, where("gorevliIdListesi", "array-contains", filterGorevliId));
                    }
                    if (filterNeden) {
                        q = query(q, where("neden", "==", filterNeden));
                    }

                    const [gorevlendirmeSnap, personelSnap] = await Promise.all([
                        getDocs(q),
                        getDocs(query(collection(db, 'personel'), where("okulId", "==", currentUserOkulId)))
                    ]);

                    const personelMap = new Map();
                    personelSnap.forEach(doc => personelMap.set(doc.id, doc.data().ad_soyad));

                    let filteredDocs = gorevlendirmeSnap.docs;
                    if (filterBitis) {
                        filteredDocs = gorevlendirmeSnap.docs.filter(doc => doc.data().tarih <= filterBitis);
                    }

                    const thead = gTbody.closest('table')?.querySelector('thead tr');
                    if (thead) {
                        thead.innerHTML = `
                            <th>Tarih</th>
                            <th>Asıl Öğretmen</th>
                            <th>Neden</th>
                            <th>Durum</th>
                            <th>Toplam Saat</th>
                            <th>Ders Detayları (Görevli)</th>
                            <th>Açıklama</th>
                            <th class="no-print">İşlemler</th>
                        `;
                    }

                    if (filteredDocs.length === 0) {
                        gTbody.innerHTML = `<tr><td colspan="8">Bu filtrelere uygun görevlendirme bulunamadı.</td></tr>`;
                        return;
                    }

                    gTbody.innerHTML = '';
                    filteredDocs.forEach(doc => {
                        const g = doc.data();
                        const asil = personelMap.get(g.asilId) || 'Bilinmiyor';
                        let detaylarHTML = '<ul class="ders-detaylari" style="margin: 0; padding-left: 15px;">';
                        if (g.detaylar && Array.isArray(g.detaylar)) {
                            g.detaylar.forEach(d => {
                                const gorevliDetay = personelMap.get(d.gorevliId);
                                const gorevliGosterim = gorevliDetay ? gorevliDetay : '<span style="color:red; font-style:italic;">Atanmadı</span>';
                                detaylarHTML += `<li>${d.sinif || '?'} / ${d.brans || '?'} (${d.saat || '?'}.D) -> ${gorevliGosterim}</li>`;
                            });
                        }
                        detaylarHTML += '</ul>';

                        const durum = g.durum === 'Eksik Atama' ? '<span style="color:red; font-weight:bold;">Eksik</span>' : 'Tamamlandı';
                        const durumStyle = g.durum === 'Eksik Atama' ? 'background-color: #ffebee;' : '';

                        const row = gTbody.insertRow();
                        row.style.cssText = durumStyle;
                        row.innerHTML = `
                            <td>${new Date(g.tarih + 'T00:00:00Z').toLocaleDateString('tr-TR', { timeZone: 'UTC' })}</td>
                            <td>${asil}</td>
                            <td>${g.neden || 'Belirtilmemiş'}</td>
                            <td>${durum}</td>
                            <td><b>${g.toplamSaat || '?'}</b></td>
                            <td>${detaylarHTML}</td>
                            <td>${g.aciklama || '-'}</td>
                            <td class="actions-cell no-print">
                               <button class="btn btn-edit btn-edit-gorev" data-id="${doc.id}">Düzenle</button>
                               <button class="btn btn-delete btn-delete-gorev" data-id="${doc.id}">Sil</button>
                            </td>
                        `;
                    });
                } catch (e) {
                    console.error("Görevlendirmeler yüklenemedi:", e);
                    showToast('Görevlendirmeler yüklenemedi.', 'error');
                    gTbody.innerHTML = `<tr><td colspan="8" style="color:red;">Veri yüklenirken bir hata oluştu.</td></tr>`;
                }
            }





            // YUKARIDA SİLDİĞİNİZ FONKSİYONUN YERİNE BUNU YAPIŞTIRIN

            async function loadAbsentTeacherSchedule() {
                const tarihInput = document.getElementById('g-tarih');
                const asilOgretmenSelect = document.getElementById('g-asil-ogretmen');
                const derslerContainer = document.getElementById('asil-ogretmen-dersleri-container');

                // Manuel atama butonlarını gizle/göster
                document.getElementById('g-kaydet-btn').style.display = 'block';
                document.getElementById('g-manuel-ata-btn').style.display = 'block';
                document.getElementById('g-manuel-kaydet-btn').style.display = 'none';

                const tarih = tarihInput.value;
                const asilOgretmenId = asilOgretmenSelect.value;
                const asilOgretmenAdi = asilOgretmenSelect.options[asilOgretmenSelect.selectedIndex]?.text;

                if (!tarih || !asilOgretmenId) {
                    derslerContainer.innerHTML = `<p style="color: #666; text-align: center; margin-top: 50px;">Lütfen tarih ve asıl öğretmen seçimi yapın.</p>`;
                    return;
                }

                derslerContainer.innerHTML = `<p style="text-align: center; margin-top: 50px;">Ders programı yükleniyor...</p>`;

                try {
                    if (typeof window.tumProgramlar === 'undefined') {
                        window.tumProgramlar = {};
                    }
                    if (Object.keys(window.tumProgramlar).length === 0) {
                        showToast("Ders programı önbelleği yükleniyor, lütfen bekleyin...", "info");
                        if (!window.classList || window.classList.length === 0) {
                            const siniflarSnap = await getSettings('ayarlar_siniflar');
                            window.classList = siniflarSnap.docs.map(d => d.data().name);
                        }
                        for (const sinif of window.classList) {
                            if (!window.tumProgramlar[sinif]) {
                                window.tumProgramlar[sinif] = await fetchScheduleDataForClass(sinif);
                            }
                        }
                    }

                    // 'dersSaatleri' (window olmadan) global dizidir, 11135. satırda tanımlı
                    if (dersSaatleri.length === 0) {
                        await loadZamanCizelgesiAyarlari();
                    }

                    const gunlerTR = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
                    const tarihDate = new Date(tarih + 'T00:00:00Z');
                    const gunAdi = gunlerTR[tarihDate.getUTCDay()];

                    if (gunAdi === "Pazar" || gunAdi === "Cumartesi") {
                        derslerContainer.innerHTML = `<p style="color: #8a6d3b; text-align: center; margin-top: 50px; background-color: #fffbe6; padding: 15px; border-radius: 6px;">Seçilen tarih (${gunAdi}) hafta sonudur. Görevlendirme yapılamaz.</p>`;
                        return;
                    }

                    const ogretmeninDersleri = [];
                    for (const sinifAdi in window.tumProgramlar) {
                        if (!window.classList.includes(sinifAdi)) continue;
                        const sinifProgrami = window.tumProgramlar[sinifAdi];
                        if (sinifProgrami && sinifProgrami[gunAdi]) {
                            for (const dersNo in sinifProgrami[gunAdi]) {
                                const dersData = sinifProgrami[gunAdi][dersNo];
                                if (dersData && dersData.ogretmen === asilOgretmenAdi) {
                                    const saatBilgisi = dersSaatleri.find(s => s.dersNo == dersNo);
                                    ogretmeninDersleri.push({
                                        dersNo: parseInt(dersNo),
                                        saat: saatBilgisi ? `${saatBilgisi.baslangic}-${saatBilgisi.bitis}` : '??:??',
                                        sinif: sinifAdi,
                                        brans: dersData.dersAdi // -> ÖNEMLİ: Branş adını (string) alıyoruz
                                    });
                                }
                            }
                        }
                    }

                    if (ogretmeninDersleri.length === 0) {
                        derslerContainer.innerHTML = `<p style="color: #666; text-align: center; margin-top: 50px;"><b>${asilOgretmenAdi}</b> adlı öğretmenin <b>${gunAdi}</b> günü için kayıtlı dersi bulunamadı.</p>`;
                        return;
                    }

                    ogretmeninDersleri.sort((a, b) => a.dersNo - b.dersNo);

                    let html = '<div style="display: flex; flex-direction: column; gap: 10px;">';
                    html += `
            <div style="display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 5px;">
                <input type="checkbox" id="select-all-gorev-dersleri" style="width: auto; margin: 0;">
                <label for="select-all-gorev-dersleri" style="margin: 0; font-weight: 600;">Tümünü Seç/Bırak</label>
            </div>
        `;

                    // YENİ HTML YAPISI: Her ders için gizli bir select alanı ekleniyor
                    ogretmeninDersleri.forEach(ders => {
                        const inputId = `gorev-ders-${ders.dersNo}`;
                        html += `
                <div class="gorev-ders-item" style="background: #fff; padding: 8px; border-radius: 5px; border: 1px solid #ddd;">
                    <div class="ders-info" style="display: flex; align-items: center; gap: 10px;">
                        <input type="checkbox" class="gorev-ders-checkbox" id="${inputId}" 
                               style="width: 20px; height: 20px; flex-shrink: 0;"
                               data-ders-no="${ders.dersNo}"
                               data-sinif="${ders.sinif}"
                               data-brans="${ders.brans}">
                        <label for="${inputId}" style="margin: 0; font-size: 0.95em; cursor: pointer; flex-grow: 1;">
                            <strong>${ders.dersNo}. Saat</strong> (${ders.saat}) - <strong>${ders.sinif}</strong> - ${ders.brans}
                        </label>
                    </div>
                    <div class="gorevli-select-container" style="display: none; margin-top: 10px; border-top: 1px dashed #ccc; padding-top: 10px;">
                        <label style="font-size: 0.9em; font-weight: 600; color: var(--theme-primary);">Görevli Öğretmeni Seçin:</label>
                        <select class="gorevli-ogretmen-select" data-ders-no="${ders.dersNo}" style="width: 100%;">
                            <option value="">Yükleniyor...</option>
                        </select>
                    </div>
                </div>
            `;
                    });
                    html += '</div>';

                    derslerContainer.innerHTML = html;

                    document.getElementById('select-all-gorev-dersleri').addEventListener('change', (e) => {
                        derslerContainer.querySelectorAll('.gorev-ders-checkbox').forEach(chk => {
                            chk.checked = e.target.checked;
                        });
                    });

                } catch (error) {
                    console.error("Öğretmenin ders programı yüklenirken hata:", error);
                    derslerContainer.innerHTML = `<p style="color: red; text-align: center; margin-top: 50px;">Hata: Öğretmenin ders programı yüklenemedi.</p>`;
                    showToast("Hata: Öğretmenin ders programı yüklenemedi.", "error");
                }
            }

            // YUKARIDA SİLDİĞİNİZ addGorevlendirme BLOĞUNUN YERİNE BUNU YAPIŞTIRIN

            // Bu fonksiyon "En Uygunu Otomatik Ata" butonu için çalışır.
            async function addGorevlendirme() {
                // 1. Form verilerini al
                const gTarih = document.getElementById('g-tarih');
                const gAsilOgretmen = document.getElementById('g-asil-ogretmen');
                const gNeden = document.getElementById('g-neden');
                const gAciklama = document.getElementById('g-aciklama');

                const tarihStr = gTarih.value;
                const asilId = gAsilOgretmen.value;
                const neden = gNeden.value;
                const aciklama = gAciklama.value.trim();

                // 2. Seçili dersleri al
                const seciliDerslerCheckboxes = document.querySelectorAll('.gorev-ders-checkbox:checked');
                const seciliDersDetaylari = [];
                seciliDerslerCheckboxes.forEach(chk => {
                    seciliDersDetaylari.push({
                        sinif: chk.dataset.sinif,
                        brans: chk.dataset.brans,
                        saat: parseInt(chk.dataset.dersNo)
                    });
                });

                // 3. Doğrulama
                if (!tarihStr || !asilId || !neden) {
                    showToast('Lütfen Tarih, Asıl Öğretmen ve Neden seçin.', 'error');
                    return;
                }
                if (seciliDersDetaylari.length === 0) {
                    showToast('Lütfen en az bir ders seçin.', 'error');
                    return;
                }

                showSpinner();
                showToast(`Otomatik atama ${tarihStr} tarihi için yapılıyor...`, 'info');

                // 4. Otomatik atama için öğretmen listesini ve GÖREV MAP'ini hazırla
                const [personelSnap, neviSnap, gorevSnap] = await Promise.all([
                    getDocs(query(collection(db, 'personel'), where("okulId", "==", currentUserOkulId))),
                    getSettings('ayarlar_personel_nevileri'),
                    getSettings('ayarlar_gorevler')
                ]);

                const gorevMap = new Map(gorevSnap.docs.map(doc => [doc.id, doc.data().name]));

                const egitimPersoneliNevi = neviSnap.docs.find(doc => doc.data().name.includes('Eğitim Personeli'));
                const egitimPersoneliNeviId = egitimPersoneliNevi ? egitimPersoneliNevi.id : null;
                const idariGorevler = new Set();
                gorevSnap.forEach(doc => {
                    const gorevAdi = doc.data().name.toLowerCase();
                    if (gorevAdi.includes('müdür') || gorevAdi.includes('rehber öğretmen')) {
                        idariGorevler.add(doc.id);
                    }
                });
                const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
                const allPotentialTeachers = [];
                personelSnap.forEach(doc => {
                    const personel = { id: doc.id, ...doc.data() };
                    const isEgitimPersoneli = personel.personel_nevisi === egitimPersoneliNeviId;
                    const isIdariGorevli = idariGorevler.has(personel.gorevi_bransi);
                    const ayrilisTarihi = personel.isten_ayrilis ? new Date(personel.isten_ayrilis) : null;
                    const isActive = !ayrilisTarihi || ayrilisTarihi > bugun;
                    if ((isEgitimPersoneli || isIdariGorevli) && isActive) {
                        allPotentialTeachers.push(personel);
                    }
                });

                // 5. O güne ait görevlendirmeleri ve kuralları önbelleğe al
                await cacheAssignmentsForDates(tarihStr, tarihStr);
                await cacheTeacherRules();

                try {
                    const gununDetaylari = [];
                    let tumDerslerAtandi = true;
                    let atanamayanDersSayisi = 0;

                    for (const detay of seciliDersDetaylari) {
                        const availableTeachers = await getAvailableTeachers(
                            tarihStr,
                            detay.saat,
                            detay.brans,
                            asilId,
                            allPotentialTeachers,
                            gorevMap
                        );

                        const enUygunGorevli = availableTeachers.length > 0 ? availableTeachers[0] : null;
                        const bulunanGorevliId = enUygunGorevli ? enUygunGorevli.id : null;

                        if (bulunanGorevliId) {
                            gununDetaylari.push({
                                ...detay,
                                gorevliId: bulunanGorevliId
                            });
                        } else {
                            gununDetaylari.push({
                                ...detay,
                                gorevliId: null
                            });
                            tumDerslerAtandi = false;
                            atanamayanDersSayisi++;
                        }
                    }

                    // 6. Görevlendirmeyi kaydet

                    // HATA ALDIĞINIZ YER BURASIYDI. BU SATIRIN EKLENDİĞİNDEN EMİN OLUN:
                    const anaGorevliId = gununDetaylari.find(d => d.gorevliId)?.gorevliId || null;

                    // Benzersiz görevli ID'lerini içeren bir liste oluştur
                    const gorevliIdListesi = [...new Set(gununDetaylari.map(d => d.gorevliId).filter(id => id !== null))];

                    const yeniGorevlendirme = {
                        okulId: currentUserOkulId,
                        tarih: tarihStr,
                        asilId,
                        gorevliId: anaGorevliId, // Tabloda ilk görünen görevli
                        gorevliIdListesi: gorevliIdListesi, // Filtreleme için
                        neden, toplamSaat: gununDetaylari.length, aciklama,
                        detaylar: gununDetaylari,
                        kayitTarihi: new Date().toISOString(),
                        durum: tumDerslerAtandi ? 'Tamamlandı' : 'Eksik Atama'
                    };

                    await addDoc(collection(db, 'ders_gorevlendirmeleri'), yeniGorevlendirme);

                    let message = `Otomatik görevlendirme kaydı oluşturuldu.`;
                    if (atanamayanDersSayisi > 0) {
                        message = `${seciliDersDetaylari.length} dersten ${atanamayanDersSayisi} tanesi için uygun öğretmen bulunamadı. Lütfen kaydı kontrol edin.`;
                        showToast(message, 'warning', 7000);
                    } else {
                        showToast(message, 'success');
                    }

                    // 7. Formu temizle
                    gTarih.valueAsDate = new Date();
                    gAsilOgretmen.value = '';
                    gNeden.value = '';
                    gAciklama.value = '';
                    document.getElementById('asil-ogretmen-dersleri-container').innerHTML = `<p style="color: #666; text-align: center; margin-top: 50px;">Lütfen tarih ve asıl öğretmen seçimi yapın.</p>`;

                    await renderGorevlendirmeTable();

                } catch (e) {
                    console.error("Görevlendirme kaydedilemedi:", e);
                    showToast('Görevlendirme kaydedilirken bir hata oluştu.', 'error');
                } finally {
                    hideSpinner();
                    teacherRulesCache = null;
                    assignmentsCache = {};
                }
            }

            async function activateManualAssignmentMode() {
                const tarihStr = document.getElementById('g-tarih').value;
                const asilId = document.getElementById('g-asil-ogretmen').value;

                const seciliDerslerCheckboxes = document.querySelectorAll('.gorev-ders-checkbox:checked');
                if (seciliDerslerCheckboxes.length === 0) {
                    showToast('Lütfen önce en az bir ders seçin.', 'error');
                    return;
                }

                showSpinner();
                showToast('Müsait öğretmenler listeleniyor...', 'info');

                // Otomatik atamadakine benzer şekilde öğretmen verilerini ve görev haritasını hazırla
                const [personelSnap, neviSnap, gorevSnap] = await Promise.all([
                    getDocs(query(collection(db, 'personel'), where("okulId", "==", currentUserOkulId))),
                    getSettings('ayarlar_personel_nevileri'),
                    getSettings('ayarlar_gorevler')
                ]);
                const gorevMap = new Map(gorevSnap.docs.map(doc => [doc.id, doc.data().name]));
                const egitimPersoneliNevi = neviSnap.docs.find(doc => doc.data().name.includes('Eğitim Personeli'));
                const egitimPersoneliNeviId = egitimPersoneliNevi ? egitimPersoneliNevi.id : null;
                const idariGorevler = new Set();
                gorevSnap.forEach(doc => {
                    const gorevAdi = doc.data().name.toLowerCase();
                    if (gorevAdi.includes('müdür') || gorevAdi.includes('rehber öğretmen')) {
                        idariGorevler.add(doc.id);
                    }
                });
                const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
                const allPotentialTeachers = [];
                personelSnap.forEach(doc => {
                    const personel = { id: doc.id, ...doc.data() };
                    const isEgitimPersoneli = personel.personel_nevisi === egitimPersoneliNeviId;
                    const isIdariGorevli = idariGorevler.has(personel.gorevi_bransi);
                    const ayrilisTarihi = personel.isten_ayrilis ? new Date(personel.isten_ayrilis) : null;
                    const isActive = !ayrilisTarihi || ayrilisTarihi > bugun;
                    if ((isEgitimPersoneli || isIdariGorevli) && isActive) {
                        allPotentialTeachers.push(personel);
                    }
                });

                try {
                    // Her seçili ders için öğretmen listesini bul ve select'i doldur
                    for (const chk of seciliDerslerCheckboxes) {
                        const dersNo = parseInt(chk.dataset.dersNo);
                        const brans = chk.dataset.brans;

                        const selectContainer = chk.closest('.gorev-ders-item').querySelector('.gorevli-select-container');
                        const selectElement = selectContainer.querySelector('.gorevli-ogretmen-select');

                        selectElement.innerHTML = '<option value="">Yükleniyor...</option>';
                        selectContainer.style.display = 'block';

                        const availableTeachers = await getAvailableTeachers(
                            tarihStr, dersNo, brans, asilId, allPotentialTeachers, gorevMap
                        );

                        if (availableTeachers.length === 0) {
                            selectElement.innerHTML = '<option value="">Müsait öğretmen bulunamadı!</option>';
                            continue;
                        }

                        // Öğretmenleri puana göre grupla (optgroup)
                        let html = '<option value="">Lütfen Görevliyi Seçin...</option>';
                        const bransdakiler = availableTeachers.filter(t => t.score === 8);
                        const digerleri = availableTeachers.filter(t => t.score < 8);

                        if (bransdakiler.length > 0) {
                            html += `<optgroup label="Aynı Branş (Önerilen)">`;
                            bransdakiler.forEach(t => {
                                html += `<option value="${t.id}">${t.ad_soyad} (${t.bransName})</option>`;
                            });
                            html += `</optgroup>`;
                        }

                        if (digerleri.length > 0) {
                            html += `<optgroup label="Diğer Müsait Öğretmenler">`;
                            digerleri.forEach(t => {
                                html += `<option value="${t.id}">${t.ad_soyad} (${t.bransName || 'Diğer'})</option>`;
                            });
                            html += `</optgroup>`;
                        }

                        selectElement.innerHTML = html;
                    }

                    // Butonların görünürlüğünü ayarla
                    document.getElementById('g-kaydet-btn').style.display = 'none';
                    document.getElementById('g-manuel-ata-btn').style.display = 'none';
                    document.getElementById('g-manuel-kaydet-btn').style.display = 'block';

                    showToast('Lütfen her ders için bir görevli seçin.', 'success');

                } catch (e) {
                    console.error("Manuel atama modu açılırken hata:", e);
                    showToast('Müsait öğretmenler listelenirken bir hata oluştu.', 'error');
                } finally {
                    hideSpinner();
                    teacherRulesCache = null;
                    assignmentsCache = {};
                }
            }

            /**
             * "Seçilenleri Manuel Kaydet" butonuna tıklandığında çalışır.
             * Select listelerinden seçilen öğretmenlerle kaydı oluşturur.
             */
            async function addGorevlendirmeManuel() {
                const gTarih = document.getElementById('g-tarih');
                const gAsilOgretmen = document.getElementById('g-asil-ogretmen');
                const gNeden = document.getElementById('g-neden');
                const gAciklama = document.getElementById('g-aciklama');

                const tarihStr = gTarih.value;
                const asilId = gAsilOgretmen.value;
                const neden = gNeden.value;
                const aciklama = gAciklama.value.trim();

                if (!tarihStr || !asilId || !neden) {
                    showToast('Lütfen Tarih, Asıl Öğretmen ve Neden seçin.', 'error');
                    return;
                }

                const seciliDersSelectleri = document.querySelectorAll('.gorevli-select-container[style*="block"] .gorevli-ogretmen-select');
                const gununDetaylari = [];
                let tumDerslerAtandi = true;
                let atanamayanDersSayisi = 0;

                for (const select of seciliDersSelectleri) {
                    const gorevliId = select.value;
                    const dersNo = parseInt(select.dataset.dersNo);
                    const checkbox = document.getElementById(`gorev-ders-${dersNo}`);
                    const detay = {
                        sinif: checkbox.dataset.sinif,
                        brans: checkbox.dataset.brans,
                        saat: dersNo,
                        gorevliId: gorevliId || null // Seçilmemişse null ata
                    };

                    if (!gorevliId) {
                        tumDerslerAtandi = false;
                        atanamayanDersSayisi++;
                    }
                    gununDetaylari.push(detay);
                }

                if (gununDetaylari.length === 0) {
                    showToast('Kaydedilecek ders bulunamadı.', 'error');
                    return;
                }

                if (atanamayanDersSayisi > 0) {
                    if (!confirm(`${atanamayanDersSayisi} ders için görevli öğretmen seçmediniz. Bu dersler 'Atanmadı' olarak kaydedilecektir. Devam etmek istiyor musunuz?`)) {
                        return;
                    }
                }

                showSpinner();
                try {
                    const anaGorevliId = gununDetaylari.find(d => d.gorevliId)?.gorevliId || null;
                    // YUKARIDAKİ BLOĞUN YERİNE BUNU YAPIŞTIRIN
                    // Benzersiz görevli ID'lerini içeren bir liste oluştur
                    const gorevliIdListesi = [...new Set(gununDetaylari.map(d => d.gorevliId).filter(id => id !== null))];

                    const yeniGorevlendirme = {
                        okulId: currentUserOkulId, tarih: tarihStr, asilId,
                        gorevliId: anaGorevliId,
                        gorevliIdListesi: gorevliIdListesi, // YENİ EKLENDİ (Filtreleme için)
                        neden, toplamSaat: gununDetaylari.length, aciklama,
                        detaylar: gununDetaylari,
                        kayitTarihi: new Date().toISOString(),
                        durum: tumDerslerAtandi ? 'Tamamlandı' : 'Eksik Atama'
                    };

                    await addDoc(collection(db, 'ders_gorevlendirmeleri'), yeniGorevlendirme);
                    showToast('Manuel görevlendirme kaydı oluşturuldu.', 'success');

                    // Formu temizle
                    gTarih.valueAsDate = new Date();
                    gAsilOgretmen.value = '';
                    gNeden.value = '';
                    gAciklama.value = '';
                    document.getElementById('asil-ogretmen-dersleri-container').innerHTML = `<p style="color: #666; text-align: center; margin-top: 50px;">Lütfen tarih ve asıl öğretmen seçimi yapın.</p>`;

                    // Butonları sıfırla
                    document.getElementById('g-kaydet-btn').style.display = 'block';
                    document.getElementById('g-manuel-ata-btn').style.display = 'block';
                    document.getElementById('g-manuel-kaydet-btn').style.display = 'none';

                    await renderGorevlendirmeTable();

                } catch (e) {
                    console.error("Manuel görevlendirme kaydedilemedi:", e);
                    showToast('Görevlendirme kaydedilirken bir hata oluştu.', 'error');
                } finally {
                    hideSpinner();
                }
            }

            // YUKARIDA SİLDİĞİNİZ FONKSİYONUN YERİNE BU İKİ FONKSİYONU YAPIŞTIRIN

            // Modal içinde öğretmen listesini getirmek için kullanılacak global değişkenler
            window.modalTeachers = [];
            window.modalGorevMap = new Map();

            /**
             * "Değiştir" butonuna tıklandığında, o ders için müsait öğretmen listesini yükler.
             */
            async function handleChangeGorevliClick(e) {
                if (!e.target.classList.contains('btn-change-gorevli')) return;

                const button = e.target;
                const li = button.closest('.edit-ders-item');
                const selectWrapper = li.querySelector('.gorevli-select-wrapper');
                const select = li.querySelector('.edit-gorevli-select');
                const displayWrapper = li.querySelector('.gorevli-display');

                // Gerekli verileri 'li' elementinin data attribute'larından al
                const dersNo = parseInt(li.dataset.dersNo);
                const bransAdi = li.dataset.bransAdi;
                const currentGorevliId = li.dataset.currentGorevliId || '';

                // Sabit verileri modal formundan al
                const tarihStr = document.getElementById('edit-g-tarih').value;
                const asilId = document.getElementById('edit-g-asil-ogretmen').value;

                // Butonu devre dışı bırak ve yükleniyor durumuna al
                button.disabled = true;
                button.textContent = 'Yükleniyor...';

                try {
                    // Müsait öğretmenleri (puanlanmış) getir
                    const availableTeachers = await getAvailableTeachers(
                        tarihStr, dersNo, bransAdi, asilId,
                        window.modalTeachers, // openEdit... fonksiyonunda dolduruldu
                        window.modalGorevMap  // openEdit... fonksiyonunda dolduruldu
                    );

                    // Select listesini doldur
                    let html = '<option value="">Atanmadı (Boş)</option>';
                    const bransdakiler = availableTeachers.filter(t => t.score === 8);
                    const digerleri = availableTeachers.filter(t => t.score < 8);

                    if (bransdakiler.length > 0) {
                        html += `<optgroup label="Aynı Branş (Önerilen)">`;
                        bransdakiler.forEach(t => {
                            html += `<option value="${t.id}">${t.ad_soyad} (${t.bransName})</option>`;
                        });
                        html += `</optgroup>`;
                    }
                    if (digerleri.length > 0) {
                        html += `<optgroup label="Diğer Müsait Öğretmenler">`;
                        digerleri.forEach(t => {
                            html += `<option value="${t.id}">${t.ad_soyad} (${t.bransName || 'Diğer'})</option>`;
                        });
                        html += `</optgroup>`;
                    }

                    select.innerHTML = html;
                    select.value = currentGorevliId; // Mevcut atamayı seçili getir

                    // Alanları göster/gizle
                    displayWrapper.style.display = 'none';
                    selectWrapper.style.display = 'block';

                } catch (error) {
                    console.error("Müsait öğretmenler getirilirken hata:", error);
                    showToast('Müsait öğretmenler listelenemedi.', 'error');
                    // Hata durumunda butonu eski haline getir
                    button.disabled = false;
                    button.textContent = 'Değiştir';
                }
            }

            /**
             * Görevlendirme Düzenleme Modalını açar ve verileri doldurur.
             */
            async function openEditGorevlendirmeModal(id) {
                const modal = document.getElementById('edit-gorevlendirme-modal');
                const dersListContainer = document.getElementById('edit-g-ders-listesi-container');
                dersListContainer.innerHTML = '<p>Ders detayları yükleniyor...</p>';

                try {
                    showSpinner();

                    // 1. Gerekli tüm verileri paralel olarak çek
                    const [gorevSnap, personelSnap, neviSnap, gorevlerSnap] = await Promise.all([
                        getDoc(doc(db, "ders_gorevlendirmeleri", id)),
                        getDocs(query(collection(db, 'personel'), where("okulId", "==", currentUserOkulId))),
                        getSettings('ayarlar_personel_nevileri'),
                        getSettings('ayarlar_gorevler')
                    ]);

                    if (!gorevSnap.exists()) {
                        throw new Error('Görevlendirme kaydı bulunamadı.');
                    }

                    const data = gorevSnap.data();

                    // 2. Haritaları ve öğretmen listelerini hazırla (getAvailableTeachers için)
                    const personelMap = new Map(personelSnap.docs.map(doc => [doc.id, doc.data().ad_soyad]));
                    window.modalGorevMap = new Map(gorevlerSnap.docs.map(doc => [doc.id, doc.data().name]));

                    const egitimPersoneliNevi = neviSnap.docs.find(doc => doc.data().name.includes('Eğitim Personeli'));
                    const egitimPersoneliNeviId = egitimPersoneliNevi ? egitimPersoneliNevi.id : null;
                    const idariGorevler = new Set();
                    gorevlerSnap.forEach(doc => {
                        const gorevAdi = doc.data().name.toLowerCase();
                        if (gorevAdi.includes('müdür') || gorevAdi.includes('rehber öğretmen')) {
                            idariGorevler.add(doc.id);
                        }
                    });
                    const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
                    window.modalTeachers = []; // Global modal listesini temizle
                    personelSnap.forEach(doc => {
                        const personel = { id: doc.id, ...doc.data() };
                        const isEgitimPersoneli = personel.personel_nevisi === egitimPersoneliNeviId;
                        const isIdariGorevli = idariGorevler.has(personel.gorevi_bransi);
                        const ayrilisTarihi = personel.isten_ayrilis ? new Date(personel.isten_ayrilis) : null;
                        const isActive = !ayrilisTarihi || ayrilisTarihi > bugun;
                        if ((isEgitimPersoneli || isIdariGorevli) && isActive) {
                            window.modalTeachers.push(personel);
                        }
                    });

                    // 3. Modal formunu doldur
                    document.getElementById('edit-g-id').value = id;
                    document.getElementById('edit-g-tarih').value = data.tarih;
                    document.getElementById('edit-g-aciklama').value = data.aciklama || '';
                    document.getElementById('edit-g-neden').value = data.neden || '';

                    const asilSelect = document.getElementById('edit-g-asil-ogretmen');
                    if (asilSelect.options.length <= 1) { // Eğer daha önce dolmadıysa
                        asilSelect.innerHTML = '';
                        personelMap.forEach((name, id) => {
                            asilSelect.add(new Option(name, id));
                        });
                    }
                    asilSelect.value = data.asilId;

                    // 4. Ders listesini yeni HTML yapısına göre oluştur
                    let html = '<ul style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 10px;">';
                    if (!data.detaylar || data.detaylar.length === 0) {
                        html = '<p>Bu görevlendirmeye ait ders detayı bulunmuyor.</p>';
                    } else {
                        for (const detay of data.detaylar) {
                            const gorevliAdi = personelMap.get(detay.gorevliId) || '<span style="color:red; font-style:italic;">Atanmadı</span>';
                            const currentGorevliId = detay.gorevliId || '';

                            html += `
                                <li class="edit-ders-item" 
                                    style="background: #f8f9fa; border: 1px solid #dee2e6; padding: 12px; border-radius: 6px;"
                                    data-ders-no="${detay.saat}" 
                                    data-brans-adi="${detay.brans}" 
                                    data-sinif="${detay.sinif}"
                                    data-current-gorevli-id="${currentGorevliId}">
                                    
                                    <div>
                                        <strong>${detay.sinif} / ${detay.brans} (${detay.saat}. Saat)</strong>
                                    </div>
                                    
                                    <div class="gorevli-display" style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                                        <span style="font-size: 0.95em;">Atanan: <strong>${gorevliAdi}</strong></span>
                                        <button type="button" class="btn btn-edit btn-change-gorevli" style="padding: 4px 10px; font-size: 0.9em;">Değiştir</button>
                                    </div>
                                    
                                    <div class="gorevli-select-wrapper" style="display: none; margin-top: 8px;">
                                        <select class="edit-gorevli-select" style="width: 100%;">
                                            <option value="">Yükleniyor...</option>
                                        </select>
                                    </div>
                                </li>
                            `;
                        }
                        html += '</ul>';
                    }

                    dersListContainer.innerHTML = html;
                    modal.classList.add('open');

                } catch (error) {
                    console.error("Görevlendirme düzenleme verisi çekilirken hata:", error);
                    showToast("Görevlendirme verisi yüklenirken bir hata oluştu.", "error");
                    dersListContainer.innerHTML = `<p style="color:red;">Hata: ${error.message}</p>`;
                } finally {
                    hideSpinner();
                }
            }
            // YUKARIDA SİLDİĞİNİZ FONKSİYONUN YERİNE BUNU YAPIŞTIRIN

            async function saveGorevlendirmeChanges(event) {
                event.preventDefault();
                const id = document.getElementById('edit-g-id').value;
                if (!id) {
                    showToast('Kaydedilecek görevlendirme bulunamadı.', 'error');
                    return;
                }

                showSpinner();

                const aciklama = document.getElementById('edit-g-aciklama').value.trim();
                const neden = document.getElementById('edit-g-neden').value;

                const yeniDetaylar = [];
                let atanamayanDersSayisi = 0;

                // Modaldaki ders listesini tara
                document.querySelectorAll('#edit-g-ders-listesi-container .edit-ders-item').forEach(li => {
                    const select = li.querySelector('.edit-gorevli-select');
                    const selectWrapper = li.querySelector('.gorevli-select-wrapper');

                    let gorevliId;

                    // Eğer "Değiştir" butonuna basıldıysa ve select alanı görünürse, oradan değeri al
                    if (selectWrapper.style.display === 'block') {
                        gorevliId = select.value || null;
                    } else {
                        // "Değiştir" butonuna hiç basılmadıysa, orijinal değeri data attribute'dan al
                        gorevliId = li.dataset.currentGorevliId || null;
                    }

                    if (!gorevliId) {
                        atanamayanDersSayisi++;
                    }

                    // `li` elementinin data attribute'larından ders detaylarını yeniden oluştur
                    yeniDetaylar.push({
                        sinif: li.dataset.sinif,
                        brans: li.dataset.bransAdi,
                        saat: parseInt(li.dataset.dersNo),
                        gorevliId: gorevliId
                    });
                });

                if (yeniDetaylar.length === 0) {
                    showToast('Kaydedilecek ders detayı bulunamadı.', 'error');
                    hideSpinner();
                    return;
                }

                const anaGorevliId = yeniDetaylar.find(d => d.gorevliId)?.gorevliId || null;

                // YUKARIDAKİ BLOĞUN YERİNE BUNU YAPIŞTIRIN
                // Benzersiz görevli ID'lerini içeren bir liste oluştur
                const gorevliIdListesi = [...new Set(yeniDetaylar.map(d => d.gorevliId).filter(id => id !== null))];

                const updatedData = {
                    aciklama: aciklama,
                    neden: neden,
                    detaylar: yeniDetaylar,
                    toplamSaat: yeniDetaylar.length,
                    gorevliId: anaGorevliId, // Ana görevliyi de güncelle
                    gorevliIdListesi: gorevliIdListesi, // YENİ EKLENDİ (Filtreleme için)
                    durum: atanamayanDersSayisi > 0 ? 'Eksik Atama' : 'Tamamlandı'
                };

                try {
                    const gorevRef = doc(db, 'ders_gorevlendirmeleri', id);
                    // merge: true kullanarak sadece bu alanları güncelle
                    await setDoc(gorevRef, updatedData, { merge: true });

                    showToast('Görevlendirme başarıyla güncellendi.');
                    document.getElementById('edit-gorevlendirme-modal').classList.remove('open');
                    await renderGorevlendirmeTable();
                } catch (error) {
                    console.error("Görevlendirme güncelleme hatası:", error);
                    showToast('Güncelleme sırasında bir hata oluştu.', 'error');
                } finally {
                    hideSpinner();
                }
            }
            async function addNobet() {
                const tarihInput = document.getElementById('nobet-tarih');
                const personelSelect = document.getElementById('nobet-personel');
                const yerSelect = document.getElementById('nobet-yeri');
                const tarih = tarihInput.value;
                const personelId = personelSelect.value;
                const nobetYeriId = yerSelect.value;
                if (!tarih || !personelId || !nobetYeriId) {
                    showToast('Lütfen Tarih, Personel ve Nöbet Yeri seçin.', 'error');
                    return;
                }
                try {
                    await addDoc(collection(db, 'nobetler'), {
                        okulId: currentUserOkulId,
                        tarih: tarih,
                        personelId: personelId,
                        nobetYeriId: nobetYeriId
                    });
                    showToast('Nöbet başarıyla eklendi.', 'success');
                    tarihInput.value = '';
                    personelSelect.value = '';
                    yerSelect.value = '';
                    const year = parseInt(document.getElementById('rapor-yil-gir').value);
                    const month = parseInt(document.getElementById('rapor-ay-sec').value);
                    await renderNobetRaporu(year, month);
                } catch (error) {
                    console.error("Nöbet eklenirken hata: ", error);
                    showToast('Nöbet eklenirken bir hata oluştu.', 'error');
                }
            }
            async function deleteSelectedNobetler() {
                const selectedCheckboxes = document.querySelectorAll('.nobet-checkbox:checked');
                if (selectedCheckboxes.length === 0) {
                    showToast('Lütfen silmek için en az bir nöbet seçin.', 'error');
                    return;
                }
                if (!confirm(`${selectedCheckboxes.length} adet nöbet kaydını silmek istediğinizden emin misiniz?`)) {
                    return;
                }
                const deletePromises = [];
                selectedCheckboxes.forEach(checkbox => {
                    const nobetId = checkbox.dataset.id;
                    deletePromises.push(deleteDoc(doc(db, 'nobetler', nobetId)));
                });
                try {
                    await Promise.all(deletePromises);
                    showToast(`${selectedCheckboxes.length} nöbet kaydı başarıyla silindi.`, 'success');
                    const year = parseInt(document.getElementById('rapor-yil-gir').value);
                    const month = parseInt(document.getElementById('rapor-ay-sec').value);
                    await renderNobetRaporu(year, month);
                } catch (error) {
                    console.error("Toplu nöbet silme hatası:", error);
                    showToast('Nöbetler silinirken bir hata oluştu.', 'error');
                }
            }
            let nobetTakipInitialized = false;
            async function initializeNobetTakip() {
                if (nobetTakipInitialized) return;
                nobetTakipInitialized = true;
                const personelSelect = document.getElementById('nobet-personel');
                const yerSelect = document.getElementById('nobet-yeri');
                const raporAySec = document.getElementById('rapor-ay-sec');
                const raporYilGir = document.getElementById('rapor-yil-gir');
                const nobetEkleBtn = document.getElementById('nobet-ekle-btn');
                const nobetRaporTbody = document.getElementById('nobet-rapor-tbody');
                const yazdirBtn = document.getElementById('btn-nobet-yazdir');
                const topluSilBtn = document.getElementById('btn-nobet-toplu-sil');
                const copySourceMonth = document.getElementById('copy-source-month');
                const copySourceYear = document.getElementById('copy-source-year');
                const copyDestMonth = document.getElementById('copy-dest-month');
                const copyDestYear = document.getElementById('copy-dest-year');
                const copyBtn = document.getElementById('copy-schedule-btn');
                const editModal = document.getElementById('edit-nobet-modal');
                const editForm = document.getElementById('edit-nobet-form');
                const personelSnap = await getDocs(query(collection(db, 'personel'), where("okulId", "==", currentUserOkulId)));
                const nobetYeriSnap = await getSettings('ayarlar_nobet_yerleri');
                const personelOptions = personelSnap.docs.map(doc => `<option value="${doc.id}">${doc.data().ad_soyad}</option>`).join('');
                personelSelect.innerHTML = '<option value="">Personel Seçiniz...</option>' + personelOptions;
                document.getElementById('edit-nobet-personel').innerHTML = personelOptions;
                const yerOptions = nobetYeriSnap.docs.map(doc => `<option value="${doc.id}">${doc.data().name}</option>`).join('');
                yerSelect.innerHTML = '<option value="">Nöbet Yeri Seçiniz...</option>' + yerOptions;
                document.getElementById('edit-nobet-yeri').innerHTML = yerOptions;
                const now = new Date();
                const aylar = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
                [raporAySec, copySourceMonth, copyDestMonth].forEach(select => {
                    select.innerHTML = '';
                    aylar.forEach((ay, index) => select.add(new Option(ay, index)));
                });
                raporAySec.value = now.getMonth();
                raporYilGir.value = now.getFullYear();
                const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
                copySourceMonth.value = prevMonth.getMonth();
                copySourceYear.value = prevMonth.getFullYear();
                copyDestMonth.value = now.getMonth();
                copyDestYear.value = now.getFullYear();
                const renderRapor = () => renderNobetRaporu(parseInt(raporYilGir.value), parseInt(raporAySec.value));
                renderRapor();
                raporAySec.addEventListener('change', renderRapor);
                raporYilGir.addEventListener('change', renderRapor);
                copyBtn.addEventListener('click', copyNobetSchedule);
                yazdirBtn.addEventListener('click', () => window.print());
                nobetEkleBtn.addEventListener('click', addNobet);
                topluSilBtn.addEventListener('click', deleteSelectedNobetler);
                editModal.querySelector('.close-modal').addEventListener('click', () => editModal.classList.remove('open'));
                editForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    await saveNobetChanges();
                });
                nobetRaporTbody.addEventListener('click', async (e) => {
                    const target = e.target;
                    if (target.classList.contains('btn-delete-nobet')) {
                        if (confirm('Bu nöbet kaydını silmek istediğinizden emin misiniz?')) {
                            await deleteDoc(doc(db, 'nobetler', target.dataset.id));
                            showToast('Nöbet kaydı silindi.');
                            renderRapor();
                        }
                    }
                    if (target.classList.contains('btn-edit-nobet')) {
                        openNobetEditModal(target.dataset.id);
                    }
                });
            }

            async function renderNobetRaporu(year, month) {
                const tbody = document.getElementById('nobet-rapor-tbody');
                const thead = tbody.closest('table').querySelector('thead tr');
                thead.innerHTML = `
        <th class="no-print" style="width: 40px;"><input type="checkbox" id="select-all-nobet" title="Tümünü Seç"></th>
        <th>Tarih</th>
        <th>Gün</th>
        <th>Nöbetçi Personel</th>
        <th>Nöbet Yeri</th>
        <th class="no-print">İşlemler</th>
    `;
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Rapor oluşturuluyor...</td></tr>`;
                const startDateString = `${year}-${String(month + 1).padStart(2, '0')}-01`;
                let endYear = year;
                let endMonth = month + 2;
                if (endMonth > 12) {
                    endMonth = 1;
                    endYear++;
                }
                const endDateString = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
                const q = query(
                    collection(db, 'nobetler'),
                    where("okulId", "==", currentUserOkulId),
                    where('tarih', '>=', startDateString),
                    where('tarih', '<', endDateString),
                    orderBy('tarih')
                );
                const [nobetSnap, personelSnap, yerSnap] = await Promise.all([
                    getDocs(q),
                    getDocs(query(collection(db, 'personel'), where("okulId", "==", currentUserOkulId))),
                    getSettings('ayarlar_nobet_yerleri')
                ]);
                const personelMap = new Map(personelSnap.docs.map(doc => [doc.id, doc.data().ad_soyad]));
                const yerMap = new Map(yerSnap.docs.map(doc => [doc.id, doc.data().name]));
                if (nobetSnap.empty) {
                    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Seçili ay için nöbet kaydı bulunamadı.</td></tr>`;
                    return;
                }
                tbody.innerHTML = '';
                const gunlerTR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
                let sonTarih = null;
                let renkIndex = 0;
                const renkler = ['renk-a', 'renk-b'];
                nobetSnap.forEach(doc => {
                    const nobet = doc.data();
                    const tarih = new Date(nobet.tarih + 'T00:00:00Z');
                    if (sonTarih !== nobet.tarih) {
                        sonTarih = nobet.tarih;
                        renkIndex = (renkIndex + 1) % 2;
                    }
                    const row = tbody.insertRow();
                    row.className = renkler[renkIndex];
                    row.innerHTML = `
            <td class="no-print" style="text-align: center;">
                <input type="checkbox" class="nobet-checkbox" data-id="${doc.id}">
            </td>
            <td>${tarih.toLocaleDateString('tr-TR', { timeZone: 'UTC' })}</td>
            <td>${gunlerTR[tarih.getUTCDay()]}</td>
            <td>${personelMap.get(nobet.personelId) || 'Bilinmiyor'}</td>
            <td>${yerMap.get(nobet.nobetYeriId) || 'Bilinmiyor'}</td>
            <td class="actions-cell no-print">
                <button class="btn btn-edit btn-edit-nobet" data-id="${doc.id}">Düzenle</button>
                <button class="btn btn-delete btn-delete-nobet" data-id="${doc.id}">Sil</button>
            </td>
        `;
                });
                document.getElementById('select-all-nobet').addEventListener('change', (e) => {
                    document.querySelectorAll('.nobet-checkbox').forEach(checkbox => {
                        checkbox.checked = e.target.checked;
                    });
                });
            }
            async function openNobetEditModal(id) {
                const modal = document.getElementById('edit-nobet-modal');
                try {
                    const docRef = doc(db, 'nobetler', id);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        document.getElementById('edit-nobet-id').value = id;
                        document.getElementById('edit-nobet-tarih').value = data.tarih;
                        document.getElementById('edit-nobet-personel').value = data.personelId;
                        document.getElementById('edit-nobet-yeri').value = data.nobetYeriId;
                        modal.classList.add('open');
                    } else {
                        showToast('Nöbet kaydı bulunamadı.', 'error');
                    }
                } catch (error) {
                    console.error("Nöbet düzenleme verisi çekilirken hata:", error);
                    showToast('Veri yüklenemedi.', 'error');
                }
            }
            async function saveNobetChanges() {
                const modal = document.getElementById('edit-nobet-modal');
                const id = document.getElementById('edit-nobet-id').value;
                const updatedData = {
                    tarih: document.getElementById('edit-nobet-tarih').value,
                    personelId: document.getElementById('edit-nobet-personel').value,
                    nobetYeriId: document.getElementById('edit-nobet-yeri').value,
                };
                if (!updatedData.tarih || !updatedData.personelId || !updatedData.nobetYeriId) {
                    return showToast('Lütfen tüm alanları doldurun.', 'error');
                }
                try {
                    await updateDoc(doc(db, 'nobetler', id), updatedData);
                    showToast('Nöbet kaydı başarıyla güncellendi.');
                    modal.classList.remove('open');
                    const year = parseInt(document.getElementById('rapor-yil-gir').value);
                    const month = parseInt(document.getElementById('rapor-ay-sec').value);
                    await renderNobetRaporu(year, month);
                } catch (error) {
                    console.error("Nöbet güncellenirken hata:", error);
                    showToast('Güncelleme sırasında bir hata oluştu.', 'error');
                }
            }
            async function copyNobetSchedule() {
                const sourceYear = parseInt(document.getElementById('copy-source-year').value);
                const sourceMonth = parseInt(document.getElementById('copy-source-month').value);
                const destYear = parseInt(document.getElementById('copy-dest-year').value);
                const destMonth = parseInt(document.getElementById('copy-dest-month').value);
                if (sourceYear === destYear && sourceMonth === destMonth) {
                    return showToast('Kaynak ve hedef ay aynı olamaz.', 'error');
                }
                const kaynakAyAdi = document.getElementById('copy-source-month').options[sourceMonth].text;
                const hedefAyAdi = document.getElementById('copy-dest-month').options[destMonth].text;
                if (!confirm(`${kaynakAyAdi} ${sourceYear} ayındaki nöbet düzenini, ${hedefAyAdi} ${destYear} ayına kopyalamak istediğinizden emin misiniz?`)) {
                    return;
                }
                showToast('Akıllı kopyalama işlemi başlatıldı...', 'info');
                const sourceStartDate = new Date(Date.UTC(sourceYear, sourceMonth, 1)).toISOString().split('T')[0];
                const sourceEndDate = new Date(Date.UTC(sourceYear, sourceMonth + 1, 1)).toISOString().split('T')[0];
                const q = query(collection(db, 'nobetler'), where("okulId", "==", currentUserOkulId), where('tarih', '>=', sourceStartDate), where('tarih', '<', sourceEndDate));
                const nobetSnap = await getDocs(q);
                if (nobetSnap.empty) {
                    return showToast('Kaynak ayda kopyalanacak nöbet kaydı bulunamadı.', 'error');
                }
                const rosterTemplate = {
                    1: new Set(),
                    2: new Set(),
                    3: new Set(),
                    4: new Set(),
                    5: new Set()
                };
                nobetSnap.forEach(doc => {
                    const nobet = doc.data();
                    const tarihUTC = new Date(nobet.tarih + 'T00:00:00Z');
                    const dayOfWeek = tarihUTC.getUTCDay();
                    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                        const dutyIdentifier = JSON.stringify({
                            p: nobet.personelId,
                            y: nobet.nobetYeriId
                        });
                        rosterTemplate[dayOfWeek].add(dutyIdentifier);
                    }
                });
                let kopyalananKayitSayisi = 0;
                const promises = [];
                const daysInDestMonth = new Date(destYear, destMonth + 1, 0).getDate();
                for (let day = 1; day <= daysInDestMonth; day++) {
                    const hedefTarihUTC = new Date(Date.UTC(destYear, destMonth, day));
                    const dayOfWeek = hedefTarihUTC.getUTCDay();
                    if (dayOfWeek === 0 || dayOfWeek === 6 || !rosterTemplate[dayOfWeek] || rosterTemplate[dayOfWeek].size === 0) {
                        continue;
                    }
                    rosterTemplate[dayOfWeek].forEach(dutyJson => {
                        const dutyInfo = JSON.parse(dutyJson);
                        const yeniNobet = {
                            okulId: currentUserOkulId,
                            personelId: dutyInfo.p,
                            nobetYeriId: dutyInfo.y,
                            tarih: hedefTarihUTC.toISOString().split('T')[0]
                        };
                        promises.push(addDoc(collection(db, 'nobetler'), yeniNobet));
                        kopyalananKayitSayisi++;
                    });
                }
                if (kopyalananKayitSayisi === 0) {
                    return showToast('Kaynak aydaki nöbetlerle eşleşen, hedef ayda uygun bir gün bulunamadı.', 'info');
                }
                try {
                    await Promise.all(promises);
                    showToast(`${kopyalananKayitSayisi} nöbet kaydı başarıyla kopyalandı!`, 'success');
                    document.getElementById('rapor-ay-sec').value = destMonth;
                    document.getElementById('rapor-yil-gir').value = destYear;
                    renderNobetRaporu(destYear, destMonth);
                } catch (error) {
                    console.error("Kopyalama sırasında hata:", error);
                    showToast('Nöbetler kopyalanırken bir hata oluştu.', 'error');
                }
            }
            async function openIzinEditModal(izinId) {
                const modal = document.getElementById('edit-izin-modal');
                const form = document.getElementById('edit-izin-form');
                try {
                    const izinDoc = await getDoc(doc(db, 'izinler', izinId));
                    if (!izinDoc.exists()) {
                        showToast('Düzenlenecek izin kaydı bulunamadı.', 'error');
                        return;
                    }
                    const izinData = izinDoc.data();
                    form.querySelector('#edit-izin-id').value = izinId;
                    form.querySelector('#edit-izin-baslangic').value = izinData.baslangicTarihi;
                    form.querySelector('#edit-izin-bitis').value = izinData.bitisTarihi;
                    form.querySelector('#edit-izin-aciklama').value = izinData.aciklama || '';
                    const personelSelect = form.querySelector('#edit-izin-personel');
                    const izinTipiSelect = form.querySelector('#edit-izin-tipi');
                    const personelDoc = await getDoc(doc(db, 'personel', izinData.personelId));
                    personelSelect.innerHTML = `<option>${personelDoc.exists() ? personelDoc.data().ad_soyad : 'Bilinmeyen Personel'}</option>`;
                    const izinTipiSnap = await getSettings('ayarlar_izin_tipleri');
                    izinTipiSelect.innerHTML = '<option value="">İzin Tipi Seçiniz...</option>';
                    izinTipiSnap.forEach(doc => izinTipiSelect.add(new Option(doc.data().name, doc.id)));
                    izinTipiSelect.value = izinData.izinTipiId;
                    modal.classList.add('open');
                } catch (error) {
                    console.error("İzin düzenleme penceresi açılırken hata:", error);
                    showToast('Veriler yüklenirken bir hata oluştu.', 'error');
                }
            }
            let izinTakipInitialized = false;
            async function initializeIzinTakip() {
                if (izinTakipInitialized) return;
                izinTakipInitialized = true;
                const personelSelect = document.getElementById('izin-personel');
                const izinTipiSelect = document.getElementById('izin-tipi');
                const baslangicInput = document.getElementById('izin-baslangic');
                const bitisInput = document.getElementById('izin-bitis');
                const kaydetBtn = document.getElementById('izin-kaydet-btn');
                const tbody = document.getElementById('izin-kayitlari-tbody');
                const izinHakkiDiv = document.getElementById('personel-izin-hakki');
                const hesaplamaSonucuDiv = document.getElementById('izin-hesaplama-sonucu');
                const [personelSnap, izinTipiSnap] = await Promise.all([
                    getDocs(query(collection(db, 'personel'), where("okulId", "==", currentUserOkulId), orderBy('ad_soyad'))),
                    getSettings('ayarlar_izin_tipleri')
                ]);
                const staffListForLeave = personelSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                personelSelect.innerHTML = '<option value="">Personel Seçiniz...</option>';
                staffListForLeave.forEach(p => personelSelect.add(new Option(p.ad_soyad, p.id)));
                izinTipiSelect.innerHTML = '<option value="">İzin Tipi Seçiniz...</option>';
                izinTipiSnap.forEach(doc => izinTipiSelect.add(new Option(doc.data().name, doc.id)));

                function updateIzinHesaplamalari() {
                    const personelId = personelSelect.value;
                    const baslangicTarihi = baslangicInput.value;
                    const bitisTarihi = bitisInput.value;
                    const seciliPersonel = staffListForLeave.find(p => p.id === personelId);
                    if (seciliPersonel) {
                        const hakEdilenGun = calculateYillikIzinHakki(seciliPersonel.ise_giris);
                        izinHakkiDiv.innerHTML = `Personelin yasal izin hakkı: <strong>${hakEdilenGun} iş günü</strong>`;
                    } else {
                        izinHakkiDiv.innerHTML = 'Yasal izin hakkı için personel seçiniz.';
                    }
                    if (baslangicTarihi && bitisTarihi && seciliPersonel) {
                        if (new Date(bitisTarihi) < new Date(baslangicTarihi)) {
                            hesaplamaSonucuDiv.style.color = 'var(--danger-color)';
                            hesaplamaSonucuDiv.innerHTML = 'Bitiş tarihi başlangıçtan önce olamaz!';
                            return;
                        }
                        const netGun = calculateNetIzinSuresi(baslangicTarihi, bitisTarihi, seciliPersonel);
                        hesaplamaSonucuDiv.style.color = '#0056b3';
                        hesaplamaSonucuDiv.innerHTML = `Kullanılacak net izin süresi: <strong>${netGun} iş günü</strong>`;
                    } else {
                        hesaplamaSonucuDiv.innerHTML = 'Net süre için personel ve tarih aralığı seçiniz.';
                    }
                }
                personelSelect.addEventListener('change', updateIzinHesaplamalari);
                baslangicInput.addEventListener('change', updateIzinHesaplamalari);
                bitisInput.addEventListener('change', updateIzinHesaplamalari);
                await renderIzinKayitlari();
                kaydetBtn.addEventListener('click', async () => {
                    const personelId = personelSelect.value;
                    const izinTipiId = izinTipiSelect.value;
                    const baslangicTarihi = baslangicInput.value;
                    const bitisTarihi = bitisInput.value;
                    const aciklama = document.getElementById('izin-aciklama').value.trim();
                    if (!personelId || !izinTipiId || !baslangicTarihi || !bitisTarihi) {
                        return showToast('Lütfen tüm zorunlu alanları doldurun.', 'error');
                    }
                    if (new Date(bitisTarihi) < new Date(baslangicTarihi)) {
                        return showToast('Bitiş tarihi başlangıç tarihinden önce olamaz.', 'error');
                    }
                    await addDoc(collection(db, 'izinler'), {
                        okulId: currentUserOkulId,
                        personelId,
                        izinTipiId,
                        baslangicTarihi,
                        bitisTarihi,
                        aciklama,
                        olusturmaTuru: 'manuel'
                    });


                    showToast('İzin başarıyla kaydedildi.');
                    const izinTipiDoc = await getDoc(doc(db, 'ayarlar_izin_tipleri', izinTipiId));
                    let requiresAssignment = false;
                    if (izinTipiDoc.exists()) {
                        const izinKod = izinTipiDoc.data().kod;
                        // Görevlendirme gerektiren kodları buraya ekleyin
                        if (['R', 'Üİ', 'I'].includes(izinKod)) { // Rapor, Ücretsiz İzin, Ücretli İzin (I yerine İ olmalı?)
                            requiresAssignment = true;
                        }
                    }

                    if (requiresAssignment) {
                        // Kullanıcıya bildirim göster ve yönlendirme seçeneği sun
                        // showToast yerine daha kalıcı bir bildirim veya confirm kullanılabilir
                        if (confirm(`İzin kaydedildi. Bu tarihler (${baslangicTarihi} - ${bitisTarihi}) için görevlendirme oluşturmak ister misiniz?`)) {
                            // Görevlendirme sekmesine geçiş yap ve bilgileri önceden doldur (opsiyonel)
                            document.querySelector('.nav-link[data-target="gorevlendirme"]').click();

                            // Gecikmeli olarak form doldurma (DOM güncellenmesini beklemek için)
                            setTimeout(() => {
                                const gTarihInput = document.getElementById('g-tarih');
                                const gAsilOgretmenSelect = document.getElementById('g-asil-ogretmen');
                                const gNedenSelect = document.getElementById('g-neden');

                                if (gTarihInput) gTarihInput.value = baslangicTarihi; // Sadece başlangıç tarihini doldur
                                if (gAsilOgretmenSelect) gAsilOgretmenSelect.value = personelId;
                                if (gNedenSelect && izinTipiDoc.exists()) gNedenSelect.value = izinTipiDoc.data().name; // Neden alanını doldur

                                showToast("Lütfen görevli öğretmeni ve ders detaylarını girin.", "info");
                            }, 500); // 500ms gecikme

                        } else {
                            showToast("İzin kaydedildi. Görevlendirme yapmayı unutmayın.", "info", 5000); // Daha uzun süre göster
                        }
                    }

                    await renderIzinKayitlari();
                    personelSelect.value = '';
                    izinTipiSelect.value = '';
                    baslangicInput.value = '';
                    bitisInput.value = '';
                    document.getElementById('izin-aciklama').value = '';
                    updateIzinHesaplamalari();
                });
                tbody.addEventListener('click', async (e) => {
                    const target = e.target;
                    if (!target.dataset.id) return;
                    const id = target.dataset.id;
                    if (target.classList.contains('btn-edit-izin')) {
                        openIzinEditModal(id);
                    }
                    if (target.classList.contains('btn-delete-izin')) {
                        if (confirm('Bu izin kaydını kalıcı olarak silmek istediğinizden emin misiniz?')) {
                            try {
                                await deleteDoc(doc(db, 'izinler', id));
                                showToast('İzin kaydı başarıyla silindi.');
                                await renderIzinKayitlari();
                            } catch (err) {
                                showToast('Silme işlemi sırasında bir hata oluştu.', 'error');
                                console.error("İzin silme hatası:", err);
                            }
                        }
                    }
                    if (target.classList.contains('btn-print-dilekce')) {
                        const modal = document.getElementById('dilekce-date-modal');
                        const dateInput = document.getElementById('dilekce-tarih-input');
                        const generateBtn = document.getElementById('generate-dilekce-with-date-btn');
                        const closeModalBtn = modal.querySelector('.close-modal');
                        dateInput.valueAsDate = new Date();
                        generateBtn.dataset.izinId = id;
                        modal.classList.add('open');
                        const handleGenerateClick = async () => {
                            const dilekceTarihi = dateInput.value;
                            const izinIdForDilekce = generateBtn.dataset.izinId;
                            if (!dilekceTarihi) {
                                showToast('Lütfen bir dilekçe tarihi seçin.', 'error');
                                return;
                            }
                            await generateDilekce(izinIdForDilekce, dilekceTarihi);
                            modal.classList.remove('open');
                        };
                        generateBtn.addEventListener('click', handleGenerateClick, {
                            once: true
                        });
                        closeModalBtn.onclick = () => {
                            modal.classList.remove('open');
                            generateBtn.removeEventListener('click', handleGenerateClick);
                        };
                    }
                });
            }
            const editForm = document.getElementById('edit-izin-form');
            editForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = editForm.querySelector('#edit-izin-id').value;
                const updatedData = {
                    izinTipiId: editForm.querySelector('#edit-izin-tipi').value,
                    baslangicTarihi: editForm.querySelector('#edit-izin-baslangic').value,
                    bitisTarihi: editForm.querySelector('#edit-izin-bitis').value,
                    aciklama: editForm.querySelector('#edit-izin-aciklama').value.trim()
                };
                if (!updatedData.izinTipiId || !updatedData.baslangicTarihi || !updatedData.bitisTarihi) {
                    return showToast('Lütfen tüm zorunlu alanları doldurun.', 'error');
                }
                try {
                    const izinRef = doc(db, 'izinler', id);
                    await setDoc(izinRef, updatedData, {
                        merge: true
                    });
                    showToast('İzin kaydı başarıyla güncellendi.');
                    document.getElementById('edit-izin-modal').classList.remove('open');
                    await renderIzinKayitlari();
                } catch (error) {
                    console.error("İzin güncelleme hatası:", error);
                    showToast('Güncelleme sırasında bir hata oluştu.', 'error');
                }
            });
            const editModal = document.getElementById('edit-izin-modal');
            editModal.querySelector('.close-modal').addEventListener('click', () => editModal.classList.remove('open'));
            editModal.addEventListener('click', (e) => {
                if (e.target === editModal) editModal.classList.remove('open');
            });
            async function openTopluIzinModal() {
                const modal = document.getElementById('toplu-izin-modal');
                const personelListContainer = document.getElementById('toplu-personel-listesi');
                const izinTipiSelect = document.getElementById('toplu-izin-tipi');
                personelListContainer.innerHTML = '<p>Personel listesi yükleniyor...</p>';
                izinTipiSelect.innerHTML = '<option value="">Yükleniyor...</option>';
                try {
                    const [personelSnap, izinTipiSnap] = await Promise.all([
                        getDocs(query(collection(db, 'personel'), where("okulId", "==", currentUserOkulId), orderBy('ad_soyad'))),
                        getSettings('ayarlar_izin_tipleri')
                    ]);
                    personelListContainer.innerHTML = '';
                    if (personelSnap.empty) {
                        personelListContainer.innerHTML = '<p>Sistemde kayıtlı personel bulunamadı.</p>';
                    } else {
                        personelSnap.forEach(doc => {
                            const p = doc.data();
                            const personelDiv = document.createElement('div');
                            personelDiv.style.cssText = 'display: flex; align-items: center;';
                            personelDiv.innerHTML = `
                    <input type="checkbox" id="p-check-${doc.id}" value="${doc.id}" style="width:auto; margin-right: 10px; flex-shrink: 0;">
                    <label for="p-check-${doc.id}" style="margin-bottom:0; font-weight: normal; cursor:pointer;">${p.ad_soyad}</label>
                `;
                            personelListContainer.appendChild(personelDiv);
                        });
                    }
                    izinTipiSelect.innerHTML = '<option value="">İzin Tipi Seçiniz...</option>';
                    if (!izinTipiSnap.empty) {
                        izinTipiSnap.forEach(doc => {
                            izinTipiSelect.add(new Option(doc.data().name, doc.id));
                        });
                    }
                    modal.classList.add('open');
                } catch (error) {
                    console.error("Toplu izin modalı hazırlanırken hata:", error);
                    showToast('Gerekli veriler yüklenemedi.', 'error');
                }
            }
            async function saveTopluIzin() {
                const baslangicTarihi = document.getElementById('toplu-izin-baslangic').value;
                const bitisTarihi = document.getElementById('toplu-izin-bitis').value;
                const izinTipiId = document.getElementById('toplu-izin-tipi').value;
                const personelCheckboxes = document.querySelectorAll('#toplu-personel-listesi input[type="checkbox"]:checked');
                if (!baslangicTarihi || !bitisTarihi || !izinTipiId) {
                    return showToast('Lütfen başlangıç/bitiş tarihi ve izin tipi seçin.', 'error');
                }
                if (new Date(bitisTarihi) < new Date(baslangicTarihi)) {
                    return showToast('Bitiş tarihi başlangıç tarihinden önce olamaz.', 'error');
                }
                if (personelCheckboxes.length === 0) {
                    return showToast('Lütfen en az bir personel seçin.', 'error');
                }
                const seciliPersonelIDs = Array.from(personelCheckboxes).map(cb => cb.value);
                showToast(`${seciliPersonelIDs.length} personel için izinler kaydediliyor...`, 'info');
                const promises = seciliPersonelIDs.map(personelId => {
                    const yeniIzin = {
                        okulId: currentUserOkulId,
                        personelId: personelId,
                        izinTipiId: izinTipiId,
                        baslangicTarihi: baslangicTarihi,
                        bitisTarihi: bitisTarihi,
                        aciklama: 'Toplu olarak eklendi.',
                        olusturmaTuru: 'toplu'
                    };
                    return addDoc(collection(db, 'izinler'), yeniIzin);
                });
                try {
                    await Promise.all(promises);
                    showToast(`${seciliPersonelIDs.length} personelin izin kaydı başarıyla oluşturuldu.`, 'success');
                    document.getElementById('toplu-izin-modal').classList.remove('open');
                    await renderIzinKayitlari();
                } catch (error) {
                    console.error("Toplu izinler kaydedilirken hata:", error);
                    showToast('Kayıt sırasında bir hata oluştu.', 'error');
                }
            }

            function calculateYillikIzinHakki(iseGirisTarihi) {
                if (!iseGirisTarihi) return 0;
                const iseGiris = new Date(iseGirisTarihi);
                const bugun = new Date();
                const kidemMs = bugun.getTime() - iseGiris.getTime();
                const kidemYil = kidemMs / (1000 * 60 * 60 * 24 * 365.25);
                if (kidemYil >= 1 && kidemYil < 5) return 14;
                if (kidemYil >= 5 && kidemYil < 15) return 20;
                if (kidemYil >= 15) return 26;
                return 0;
            }

            function calculateNetIzinSuresi(startDateStr, endDateStr, personel, izinTipiKodu) {
                if (!startDateStr || !endDateStr || !personel) return 0;
                const startDate = new Date(startDateStr + 'T00:00:00');
                const endDate = new Date(endDateStr + 'T00:00:00');
                if (endDate < startDate) return 0;
                if (izinTipiKodu === 'R' || izinTipiKodu === 'Üİ') {
                    const diffTime = Math.abs(endDate - startDate);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                    return diffDays;
                } else {
                    let netGunSayisi = 0;
                    let mevcutTarih = new Date(startDate);
                    while (mevcutTarih <= endDate) {
                        const dayOfWeek = mevcutTarih.getDay();
                        let isWeekend = false;
                        if (personel.sozlesme_turu === 'Belirli Süreli') {
                            if (dayOfWeek === 0 || dayOfWeek === 6) isWeekend = true;
                        } else {
                            if (dayOfWeek === 0) isWeekend = true;
                        }
                        if (!isWeekend && !isResmiTatil(mevcutTarih)) {
                            netGunSayisi++;
                        }
                        mevcutTarih.setDate(mevcutTarih.getDate() + 1);
                    }
                    return netGunSayisi;
                }
            }

            async function loadProgramlamaKurallari() {
                try {
                    const docRef = doc(db, "programlama_kurallari", currentUserOkulId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const kurallar = docSnap.data();
                        document.getElementById('kural-aktif-max-gunluk-ders').checked = kurallar.maxGunlukDers?.aktif || false;
                        document.getElementById('kural-deger-max-gunluk-ders').value = kurallar.maxGunlukDers?.deger || 2;
                        document.getElementById('kural-aktif-max-blok-ders').checked = kurallar.maxBlokDers?.aktif || false;
                        document.getElementById('kural-deger-max-blok-ders').value = kurallar.maxBlokDers?.deger || 2;
                        document.getElementById('kural-aktif-bosluk-birakma').checked = kurallar.boslukBirakma?.aktif || false;
                    }
                } catch (error) {
                    console.error("Programlama kuralları yüklenirken hata:", error);
                }
            }

            async function saveProgramlamaKurallari() {
                const kurallar = {
                    maxGunlukDers: {
                        aktif: document.getElementById('kural-aktif-max-gunluk-ders').checked,
                        deger: parseInt(document.getElementById('kural-deger-max-gunluk-ders').value)
                    },
                    maxBlokDers: {
                        aktif: document.getElementById('kural-aktif-max-blok-ders').checked,
                        deger: parseInt(document.getElementById('kural-deger-max-blok-ders').value)
                    },
                    boslukBirakma: {
                        aktif: document.getElementById('kural-aktif-bosluk-birakma').checked
                    },
                    okulId: currentUserOkulId
                };

                try {
                    const docRef = doc(db, "programlama_kurallari", currentUserOkulId);
                    await setDoc(docRef, kurallar, { merge: true });
                    showToast('Programlama kuralları başarıyla kaydedildi.', 'success');
                } catch (error) {
                    console.error("Programlama kuralları kaydedilirken hata:", error);
                    showToast('Kurallar kaydedilirken bir hata oluştu.', 'error');
                }
            }

            async function renderIzinKayitlari() {
                const tbody = document.getElementById('izin-kayitlari-tbody');
                tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">İzin kayıtları yükleniyor...</td></tr>`;
                const [izinSnap, personelSnap, izinTipiSnap] = await Promise.all([
                    getDocs(query(collection(db, 'izinler'), where("okulId", "==", currentUserOkulId), orderBy('baslangicTarihi', 'desc'))),
                    getDocs(query(collection(db, 'personel'), where("okulId", "==", currentUserOkulId))),
                    getSettings('ayarlar_izin_tipleri')
                ]);
                const izinTipiDataMap = new Map(izinTipiSnap.docs.map(doc => [doc.id, doc.data()]));
                const personelDataMap = new Map(personelSnap.docs.map(doc => [doc.id, {
                    id: doc.id,
                    ...doc.data()
                }]));
                if (izinSnap.empty) {
                    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Kayıtlı izin bulunamadı.</td></tr>`;
                    return;
                }
                tbody.innerHTML = '';
                izinSnap.forEach(doc => {
                    const izin = doc.data();
                    const personel = personelDataMap.get(izin.personelId);
                    if (!personel) {
                        console.warn(`ID'si ${doc.id} olan izin kaydına bağlı personel (${izin.personelId}) bulunamadı. Listede gösterilmeyecek.`);
                        return;
                    }
                    const baslangic = new Date(izin.baslangicTarihi + 'T00:00:00');
                    const bitis = new Date(izin.bitisTarihi + 'T00:00:00');
                    const izinTipi = izinTipiDataMap.get(izin.izinTipiId);
                    const izinTipiKodu = izinTipi ? izinTipi.kod : '';
                    const sure = calculateNetIzinSuresi(izin.baslangicTarihi, izin.bitisTarihi, personel, izinTipiKodu);
                    const sureEtiketi = (izinTipiKodu === 'R' || izinTipiKodu === 'Üİ') ? 'gün' : 'iş günü';
                    const row = tbody.insertRow();
                    row.innerHTML = `
            <td>${personel.ad_soyad || 'Bilinmiyor'}</td>
            <td>${izinTipi ? izinTipi.name : 'Bilinmiyor'}</td>
            <td>${baslangic.toLocaleDateString('tr-TR')}</td>
            <td>${bitis.toLocaleDateString('tr-TR')}</td>
            <td>${sure} ${sureEtiketi}</td> <td>${izin.aciklama || '-'}</td>
            <td class="actions-cell">
    <td class="actions-cell">
    <button class="btn btn-print-dilekce" data-id="${doc.id}" style="background-color:#0dcaf0;">Dilekçe</button>
    <button class="btn btn-edit btn-edit-izin" data-id="${doc.id}">Düzenle</button>
    <button class="btn btn-delete-izin btn-delete" data-id="${doc.id}">Sil</button>
</td>
        `;
                });
            }

            function renderPersonelGorevlendirmeGecmisi(gorevlendirmeSnap, personelId, personelMap) {
                const container = document.getElementById('personel-gorev-gecmisi-container');
                if (!container) return;

                if (gorevlendirmeSnap.empty) {
                    container.innerHTML = '<p style="padding: 20px; text-align: center;">Bu personel herhangi bir derse görevlendirilmemiş.</p>';
                    return;
                }

                let tableHTML = '<table class="gorevlendirme-table"><thead><tr><th>Tarih</th><th>Asıl Öğretmen</th><th>Sınıf</th><th>Ders</th><th>Saat</th></tr></thead><tbody>';
                let toplamGorevSayisi = 0;

                gorevlendirmeSnap.forEach(doc => {
                    const gorev = doc.data();
                    const asilOgretmenAdi = personelMap.get(gorev.asilId) || 'Bilinmiyor';

                    // Bu görevlendirmenin detaylarını tara ve sadece bu personelin girdiği dersleri bul
                    const personelinGirdigiDersler = gorev.detaylar.filter(d => d.gorevliId === personelId);

                    personelinGirdigiDersler.forEach(ders => {
                        toplamGorevSayisi++;
                        tableHTML += `
                            <tr>
                                <td>${formatDateDDMMYYYY(gorev.tarih)}</td>
                                <td>${asilOgretmenAdi}</td>
                                <td>${ders.sinif}</td>
                                <td>${ders.brans}</td>
                                <td>${ders.saat}. Ders</td>
                            </tr>
                        `;
                    });
                });

                if (toplamGorevSayisi === 0) {
                    container.innerHTML = '<p style="padding: 20px; text-align: center;">Bu personel herhangi bir derse görevlendirilmemiş.</p>';
                    return;
                }

                tableHTML += '</tbody></table>';
                container.innerHTML = tableHTML;
            }
            async function generateDilekce(izinId, dilekceTarihiStr) {
                const izinDoc = await getDoc(doc(db, 'izinler', izinId));
                if (!izinDoc.exists()) {
                    showToast('İzin kaydı bulunamadı.', 'error');
                    return;
                }
                const izin = izinDoc.data();
                const [personelDoc, izinTipiDoc, gorevSnap] = await Promise.all([
                    getDoc(doc(db, 'personel', izin.personelId)),
                    getDoc(doc(db, 'ayarlar_izin_tipleri', izin.izinTipiId)),
                    getSettings('ayarlar_gorevler')
                ]);
                if (!personelDoc.exists() || !izinTipiDoc.exists()) {
                    showToast('Personel veya İzin Tipi tanımı bulunamadı.', 'error');
                    return;
                }
                const personel = personelDoc.data();
                const izinTipi = izinTipiDoc.data();
                const gorevMap = new Map(gorevSnap.docs.map(doc => [doc.id, doc.data().name]));
                const iseBaslama = new Date(izin.bitisTarihi + 'T00:00:00');
                iseBaslama.setDate(iseBaslama.getDate() + 1);
                const baslangicTR = formatDateDDMMYYYY(izin.baslangicTarihi);
                const bitisTR = formatDateDDMMYYYY(izin.bitisTarihi);
                const iseBaslamaTR = iseBaslama.toLocaleDateString('tr-TR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });
                const okulAdi = await getCurrentSchoolName();
                const iseGirisTR = formatDateDDMMYYYY(personel.ise_giris);
                const dilekceTarihiTR = formatDateDDMMYYYY(dilekceTarihiStr);
                const gorevi = gorevMap.get(personel.gorevi_bransi) || 'Belirtilmemiş';
                const baslangicYili = new Date(izin.baslangicTarihi + 'T00:00:00').getFullYear();
                let izinIstekMetni = `Okulunuzdaki ${baslangicYili} yılına ait yıllık ücretli iznimi, ${baslangicTR} tarihinden itibaren kullanmak istiyorum.`;
                if (!izinTipi.name.toLowerCase().includes('yıllık')) {
                    izinIstekMetni = `${izin.aciklama || 'Mazeretimden'} dolayı ${baslangicTR} - ${bitisTR} tarihleri arasında izinli sayılmamı talep ediyorum.`;
                }
                const dilekceHTML = `
        <!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>İzin Formu - ${personel.ad_soyad}</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 11pt; margin: 1.0cm; line-height: 1.3; }
            h2, .header-section { text-align: center; }
            .info-table, .footer-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
            .info-table td { padding: 8px; border: 1px solid #ccc; }
            .info-table td:first-child { width: 180px; font-weight: bold; background-color: #f2f2f2; }
            .footer-table td { text-align: left; padding: 8px 4px; }
            .footer-table td:nth-child(2) { font-weight: bold; }
            .content { text-indent: 1.5em; margin-bottom: 25px; }
            .date-signature-block { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px; }
            .date-signature-block { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px; }
            .approval-section { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc; text-align: center; }
        </style></head><body>
            <div>
                <h2>${izinTipi.name.toLocaleUpperCase('tr-TR')} İSTEK FORMU</h2>
<div class="header-section"><h3>${okulAdi.toLocaleUpperCase('tr-TR')} MÜDÜRLÜĞÜNE</h3></div>
                <p style="text-align:right;">TAVŞANLI</p>
                <table class="info-table">
                    <tr><td>ADI SOYADI</td><td>: ${personel.ad_soyad || ''}</td></tr>
                    <tr><td>T.C. KİMLİK NO</td><td>: ${personel.tc_kimlik_no || ''}</td></tr>
                    <tr><td>SGK NO</td><td>: ${personel.sgk_no || ''}</td></tr>
                    <tr><td>İŞE GİRİŞ TARİHİ</td><td>: ${iseGirisTR}</td></tr>
                    <tr><td>GÖREVİ</td><td>: ${gorevi}</td></tr>
                    <tr><td>GÖREV YERİ ADRESİ</td><td>: Hanımçeşme Mah. Gündüz Sokak No:13 TAVŞANLI/KÜTAHYA</td></tr>
                </table>
                <p class="content">${izinIstekMetni}</p>
                <p>Gereğini arz ederim.</p>
                <div class="date-signature-block">
                    <div><b>Tarih: ${dilekceTarihiTR}</b></div>
                    <div>
                        İzin Talep Eden<br><br>
                        ${personel.ad_soyad}<br>
                        (İmza)
                    </div>
                </div>
                <div class="approval-section">
                    <p>Yukarıda belirtilen tarihlerde ${izinTipi.name.toLowerCase()} kullanması uygundur.</p>
                    <div style="margin-top: 50px;">Okul Müdürü<br>(İmza)</div>
                </div>
                <h4 style="margin-top: 50px; margin-bottom: 15px; border-bottom: 1px solid #000; padding-bottom: 5px;">İzin Bölümünce Doldurulacak</h4>
                <table class="footer-table">
                    <tr>
                        <td>İzine Çıkış Tarihi</td><td>: ${baslangicTR}</td><td>İmza:</td>
                    </tr>
                    <tr>
                        <td>İzin Bitiş Tarihi</td><td>: ${bitisTR}</td><td>İmza:</td>
                    </tr>
                    <tr>
                        <td>İşe Başlama Tarihi</td><td>: ${iseBaslamaTR}</td><td>İmza:</td>
                    </tr>
                </table>
            </div>
        </body></html>`;
                const win = window.open('', '_blank');
                win.document.write(dilekceHTML);
                win.document.close();
                setTimeout(() => win.print(), 500);
            }

