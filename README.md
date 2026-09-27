# ติดตามพอร์ตการลงทุน 

เว็บแอปสำหรับบันทึกและติดตามพอร์ตการลงทุน (กองทุน/หุ้น) ส่วนตัว
ล็อกอินด้วย Gmail และเก็บข้อมูลทั้งหมดไว้ใน Google Sheets ของคุณเอง (ไฟล์ชื่อ
"Investment Tracker Data" จะถูกสร้างในไดรฟ์ของคุณโดยอัตโนมัติตอนใช้งานครั้งแรก)

## ฟีเจอร์ (เวอร์ชันแรก)

- ล็อกอินด้วย Google เฉพาะอีเมลที่อนุญาต
- เพิ่มสินทรัพย์ (กองทุน/หุ้น) พร้อมหมวดพอร์ต
- บันทึกธุรกรรมซื้อ/ขาย และคำนวณต้นทุนเฉลี่ย + กำไร/ขาดทุนอัตโนมัติ
- อัปเดตราคา/NAV ล่าสุดด้วยตนเอง พร้อมเก็บสแนปช็อตมูลค่าพอร์ตรายวัน
- แดชบอร์ดสรุปพอร์ตรวมและแยกตามหมวด
- กราฟแนวโน้มมูลค่าพอร์ตย้อนหลัง

---

## ขั้นตอนที่ 1: สร้าง Google OAuth Client (ทำครั้งเดียว)

1. ไปที่ https://console.cloud.google.com/ แล้วสร้างโปรเจกต์ใหม่ (ชื่ออะไรก็ได้ เช่น "Investment Tracker")
2. ไปที่เมนู **APIs & Services > OAuth consent screen**
   - User Type เลือก **External**
   - กรอกชื่อแอป, อีเมลติดต่อ ตามจริง
   - ในหน้า **Test users** ให้เพิ่มอีเมล Gmail ของคุณ (เช่น thitiwat597@gmail.com)
   - ไม่ต้องขอ verify แอป เพราะใช้เองคนเดียว (สถานะ "Testing" ใช้งานได้เลย)
3. ไปที่ **APIs & Services > Library** ค้นหาแล้วเปิดใช้งาน (Enable) 2 ตัวนี้:
   - Google Sheets API
   - Google Drive API
4. ไปที่ **APIs & Services > Credentials > Create Credentials > OAuth client ID**
   - Application type: **Web application**
   - Authorized redirect URIs ใส่ 2 บรรทัด:
     - `http://localhost:3000/api/auth/callback/google` (ใช้ตอนทดสอบในเครื่อง)
     - `https://<โดเมนเว็บจริงของคุณ>/api/auth/callback/google` (ใส่ทีหลังตอน deploy ขึ้น Vercel แล้ว)
   - กด Create จะได้ **Client ID** และ **Client Secret** มา เก็บไว้ใช้ขั้นตอนถัดไป

## ขั้นตอนที่ 2: ตั้งค่าไฟล์ .env.local (ทดสอบในเครื่อง)

1. คัดลอกไฟล์ `.env.local.example` เป็น `.env.local`
2. ใส่ค่า:
   - `AUTH_SECRET` — สร้างด้วยคำสั่ง `npx auth secret` (รันในโฟลเดอร์โปรเจกต์)
   - `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — จากขั้นตอนที่ 1
   - `ALLOWED_EMAILS` — อีเมล Gmail ของคุณ

## ขั้นตอนที่ 3: รันทดสอบในเครื่อง

```bash
npm install
npm run dev
```

เปิด http://localhost:3000 แล้วลองล็อกอินด้วย Gmail ของคุณ

## ขั้นตอนที่ 4: Deploy ขึ้นเว็บจริง (Vercel)

1. สมัคร/ล็อกอิน https://vercel.com (ใช้ GitHub ล็อกอินได้)
2. อัปโหลดโปรเจกต์นี้ขึ้น GitHub (repo ส่วนตัว) แล้วกด **Import Project** ใน Vercel เลือก repo นี้
3. ในหน้า Environment Variables ของ Vercel ใส่ตัวแปรชุดเดียวกับ `.env.local` (AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, ALLOWED_EMAILS)
4. กด Deploy จะได้โดเมน เช่น `https://investment-tracker-xxxx.vercel.app`
5. กลับไปที่ Google Cloud Console > Credentials > OAuth client ID ที่สร้างไว้ แล้วเพิ่ม
   `https://investment-tracker-xxxx.vercel.app/api/auth/callback/google` ใน Authorized redirect URIs
6. เข้าเว็บผ่านโดเมนนั้นจากมือถือ/คอมไหนก็ได้ แล้วล็อกอินด้วย Gmail เดิม

---

## วิธีใช้งาน

1. **สินทรัพย์** — เพิ่มกองทุน/หุ้นที่ถืออยู่ พร้อมระบุหมวด (CORE, Cash, Future, Gold, หุ้นสหรัฐ ฯลฯ)
2. **ธุรกรรม** — บันทึกทุกครั้งที่ซื้อ/ขาย ระบบจะคำนวณต้นทุนเฉลี่ยให้เอง
3. **อัปเดตราคา** — กรอกราคา/NAV ล่าสุดเป็นระยะ (เช่นทุกวัน) กดบันทึกจะเก็บมูลค่าพอร์ต ณ วันนั้นไว้ในหน้าประวัติด้วย
4. **แดชบอร์ด** — ดูสรุปมูลค่าพอร์ตรวม กำไร/ขาดทุน แยกตามหมวด
5. **ประวัติ** — ดูกราฟแนวโน้มมูลค่าพอร์ตย้อนหลัง

ข้อมูลทั้งหมดเก็บอยู่ในไฟล์ Google Sheets ชื่อ "Investment Tracker Data" ในไดรฟ์ของคุณ เปิดดูข้อมูลดิบได้ตลอดเวลา

---

## ดึงราคาอัตโนมัติรายวัน (ไม่ต้องเปิดเว็บเอง)

หน้า "อัปเดตราคา" มีปุ่ม "ดึงราคาล่าสุด" ให้กดเองได้อยู่แล้ว แต่ถ้าอยากให้ระบบดึงราคา + บันทึกสแนปช็อตให้อัตโนมัติทุกวัน (เช่น ตอน 8:00 น.) โดยไม่ต้องเปิดเว็บเอง ทำตามนี้:

**ข้อจำกัด**: วิธีนี้ใช้ได้เฉพาะตอนที่ `npm run dev` (หรือ `npm start` ถ้า build แล้ว) กำลังรันอยู่บนเครื่องนี้เท่านั้น ถ้าปิดเครื่อง/ปิดเซิร์ฟเวอร์ตอน 8 โมง งานจะไม่ทำงานวันนั้น ถ้าต้องการให้ทำงานแน่นอนทุกวันแม้ปิดเครื่อง ต้อง deploy ขึ้น Vercel แล้วใช้ Vercel Cron แทน (ดูหัวข้อ deploy ด้านบน)

### ขั้นตอนที่ 1: เอา Refresh Token มาใส่ (ทำครั้งเดียว)

1. ใส่ `DEBUG_PRINT_REFRESH_TOKEN=true` ใน `.env.local`
2. รัน `npm run dev` แล้วล็อกเอาต์ + ล็อกอินใหม่อีกครั้งด้วย Gmail ของคุณ (ต้องเป็นการล็อกอินใหม่จริงๆ ถึงจะได้ refresh token)
3. ดูที่ terminal ที่รัน `npm run dev` จะมีบรรทัด `[DEBUG_PRINT_REFRESH_TOKEN] Google refresh token: ...` — คัดลอกค่านั้นไปใส่ `GOOGLE_REFRESH_TOKEN=` ใน `.env.local`
4. ลบบรรทัด `DEBUG_PRINT_REFRESH_TOKEN=true` ออกจาก `.env.local` (ไม่ต้องใช้อีกแล้ว)
5. ใส่ `CRON_SECRET=` ตามด้วยรหัสยาวๆ ที่สุ่มขึ้นมาเอง (ห้ามให้ใครรู้)
6. รัน `npm run dev` ใหม่อีกครั้งให้ค่าที่แก้มีผล

### ขั้นตอนที่ 2: ตั้งเวลาให้เรียกอัตโนมัติทุกวัน 8:00 น. (Windows Task Scheduler)

เปิด Task Scheduler แล้วสร้าง Basic Task ใหม่ ตั้งให้รันทุกวันเวลา 8:00 น. โดย Action เป็น "Start a program":
- Program/script: `powershell.exe`
- Add arguments:
  ```
  -Command "Invoke-RestMethod -Uri 'http://localhost:3000/api/cron/fetch-prices' -Headers @{Authorization='Bearer <CRON_SECRET ของคุณ>'}"
  ```

ทดสอบก่อนได้โดยรันคำสั่ง PowerShell ด้านบนเองตอนที่ `npm run dev` กำลังรันอยู่ ถ้าสำเร็จจะได้ผลลัพธ์ JSON กลับมาแสดงรายการราคาที่ดึงได้
