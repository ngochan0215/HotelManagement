## HOTELMANAGEMENT DESCRIPTION
A role-based hotel management system supporting admin operations, reservation and resource management, incident handling, and task assignment for receptionists, housekeeping, and technicians.

## TECH STACK
- Backend: Node.js, Express.js
- Frontend: HTML5, Tailwind CSS, ReactJS, TypeScript
- Database: MongoDB 

## HOW TO RUN
### 1. Clone project
```bash
git clone https://github.com/ngochan0215/HotelManagement.git
cd HotelManagement
```
### 2. Run Backend
You can either run the 3rd or the 4th command line after moving to server folder
```bash
cd server
npm install
npm run dev  
node --watch server.js
```

### 3. Run Frontend
```bash
cd client
npm install
npm run dev
```

## TEAM MEMBERS
| STT | MSSV     | Họ và Tên            | GitHub                              | Email                  |
|-----|----------|----------------------|-------------------------------------|------------------------|
| 1   | 23520436 | Phan Thị Ngọc Hân    | https://github.com/ngochan0215    | 23520436@gm.uit.edu.vn |
| 2   | 23521533 | Chế Vũ Anh Thư       | https://github.com/anhthucv       | 23521533@gm.uit.edu.vn |

## FILE .env
```bash
PORT=your_port
DB_URI=your_db_uri
JWT_SECRET=your_secret_key

EMAIL_USER=your_gmail
EMAIL_PASS=your_name

CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

PAYOS_CLIENT_ID=your_payos_client_id
PAYOS_API_KEY=your_payos_api_key
PAYOS_CHECKSUM_KEY=your_payos_checksum_key

PAYOS_PAYOUT_CLIENT_ID=your_payos_checkout_client_id
PAYOS_PAYOUT_API_KEY=your_payos_checkout_api_key
PAYOS_PAYOUT_CHECKSUM_KEY=your_payos_checkout_checksum_key

BACKEND_URL=your_server_url
FRONTEND_URL=your_client_url
VITE_API_BASE_URL=your_vite_api_base_url
```
