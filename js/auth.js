// VERSİYONLAR DÜZELTİLDİ: 10.7.1 (firebase-config.js ile aynı yapıldı)
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    getDoc, 
    setDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { auth, db } from "./firebase-config.js";

export async function sistemGiris(girdi, sifre) {
    // 1. Girdiyi Temizle (Boşlukları sil)
    girdi = girdi.trim();
    sifre = sifre.trim();

    // 2. E-Posta formatına çevir
    let email;
    let telefonNo = "";

    if (girdi.includes('@')) {
        email = girdi;
    } else {
        // Telefon numarasını temizle (Boşlukları al, başında 0 varsa sil)
        telefonNo = girdi.replace(/\s/g, '');
        if (telefonNo.startsWith('0')) telefonNo = telefonNo.substring(1);
        email = `${telefonNo}@koop.com`;
    }

    try {
        console.log("Giriş deneniyor:", email);
        
        // 3. GİRİŞ YAPMAYI DENE
        await signInWithEmailAndPassword(auth, email, sifre);
        
        // Başarılıysa yönlendir
        if(auth.currentUser) {
            await yonlendir(auth.currentUser);
        }

    } catch (error) {
        console.error("Giriş Hatası Detayı:", error);

        // --- HATA ANALİZİ ---
        
        // Hata 1: Kullanıcı Auth'da Yok (Ama veritabanında olabilir - Üye Girişi)
        if ((error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') && !girdi.includes('@')) {
            
            console.log("Kullanıcı Auth'da yok, Üye listesi kontrol ediliyor...");
            
            // Members tablosunda bu telefonu arayalım
            const q = query(collection(db, "members"), where("telefon", "==", `0${telefonNo}`)); 
            const q2 = query(collection(db, "members"), where("telefon", "==", telefonNo));
            
            const snapshot1 = await getDocs(q);
            const snapshot2 = await getDocs(q2);

            let bulunanUye = null;
            if (!snapshot1.empty) bulunanUye = snapshot1.docs[0];
            else if (!snapshot2.empty) bulunanUye = snapshot2.docs[0];

            if (bulunanUye) {
                const uyeData = bulunanUye.data();
                try {
                    // Otomatik Hesap Oluştur
                    const userCred = await createUserWithEmailAndPassword(auth, email, sifre);
                    const user = userCred.user;

                   // Users tablosuna yetki yaz (İSİM DÜZELTMESİ EKLENDİ)
                    await setDoc(doc(db, "users", user.uid), {
                        email: email,
                        adSoyad: `${uyeData.ad} ${uyeData.soyad}`, // <-- İSMİ ARTIK BURADAN ALIYOR
                        role: 'member',
                        coopId: uyeData.coopId,
                        relatedMemberId: bulunanUye.id,
                        createdAt: new Date()
                    });

                    alert("✅ Hesabınız oluşturuldu! Giriş yapılıyor...");
                    await yonlendir(user);

                } catch (createError) {
                    alert("Kayıt oluşturma hatası: " + createError.message);
                }
            } else {
                alert("❌ BU TELEFON SİSTEMDE KAYITLI DEĞİL.\nLütfen yöneticinizle görüşün.");
            }
        } 
        // Hata 2: Şifre Yanlış
        else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            alert("❌ ŞİFRE YANLIŞ.\nLütfen şifrenizi kontrol edip tekrar deneyin.");
        } 
        // Hata 3: Çok fazla deneme yapıldı
        else if (error.code === 'auth/too-many-requests') {
            alert("⚠️ ÇOK FAZLA HATALI DENEME.\nLütfen biraz bekleyip tekrar deneyin veya şifrenizi sıfırlayın.");
        }
        // Diğer Hatalar
        else {
            alert("Giriş Hatası: " + error.code + "\n" + error.message);
        }
    }
}

async function yonlendir(user) {
    console.log("Yönlendiriliyor: ", user.email);
    
    // Kullanıcıyı Firestore'dan bul
    const q = query(collection(db, "users"), where("email", "==", user.email));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
        const data = querySnapshot.docs[0].data();
        const kullaniciRolu = data.role || data.rol; 
        const kurumID = data.coopId || data.kurumID;

        // Süper Admin Kontrolü (Lisans süresine takılmaz)
        if (kullaniciRolu === 'superadmin') {
            // DİKKAT: super_admin.html dosyasının panels klasöründe olduğundan emin olun!
            window.location.href = "panels/super_admin.html";
            return;
        }

        // Diğer Roller İçin Lisans Kontrolü
        if (kurumID) { 
            try {
                const coopDoc = await getDoc(doc(db, "cooperatives", kurumID));
                if (coopDoc.exists()) {
                    const coopData = coopDoc.data();
                    if (coopData.licenseEndDate) {
                        const bitis = coopData.licenseEndDate.toDate();
                        const bugun = new Date();
                        if (bugun > bitis) {
                            alert("⚠️ LİSANS SÜRESİ DOLDU!\nLütfen sistem sağlayıcınızla iletişime geçin.");
                            await signOut(auth);
                            window.location.href = "giriş.html";
                            return;
                        }
                    }
                }
            } catch (err) {
                console.error("Lisans kontrol hatası:", err);
            }
        }

        // Session Kayıtları
        sessionStorage.setItem("userRole", kullaniciRolu);
        sessionStorage.setItem("coopId", kurumID); 

        // Yönlendirmeler
        if (kullaniciRolu === 'admin' || kullaniciRolu === 'yonetici') {
            window.location.href = "panels/admin.html";
        }
        else if (kullaniciRolu === 'member' || kullaniciRolu === 'uye') {
            window.location.href = "panels/member.html";
        }
        else if (kullaniciRolu === 'driver' || kullaniciRolu === 'sofor') {
            window.location.href = "panels/driver.html";
        }
        else {
            alert("HATA: Kullanıcı rolü tanımsız (" + kullaniciRolu + ")");
        }
    } else {
        alert("Kullanıcı veritabanında (Firestore Users tablosunda) bulunamadı!");
    }
}