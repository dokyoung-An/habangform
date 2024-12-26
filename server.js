require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express();
const PORT = 3000;

// MongoDB 연결
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('MongoDB에 성공적으로 연결되었습니다!'))
    .catch(err => console.error('MongoDB 연결 실패:', err));

// 스키마와 모델 정의
const customerSchema = new mongoose.Schema({
    customerName: String,
    serviceDate: Date,
    apartmentName: String,
    apartmentSize: String,
    contactNumber: String,
    status: { type: String, default: '상담대기' },
    customerNumber: Number,
}, { timestamps: true });

// 고객 번호 자동 증가 설정
customerSchema.pre('save', async function (next) {
    if (!this.customerNumber) {
        try {
            const lastCustomer = await Customer.findOne().sort({ customerNumber: -1 });
            this.customerNumber = lastCustomer ? lastCustomer.customerNumber + 1 : 8729; // 시작 번호 설정
            next();
        } catch (err) {
            console.error('고객 번호 생성 중 오류:', err);
            next(err);
        }
    } else {
        next();
    }
});

const Customer = mongoose.model('Customer', customerSchema);

// 정적 파일 제공 설정
app.use(express.static('public'));

// Body-parser 설정
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 데이터 저장
app.post('/submit', async (req, res) => {
    try {
        const customer = new Customer(req.body);
        await customer.save();
        res.send('데이터가 저장되었습니다!');
    } catch (err) {
        console.error('데이터 저장 실패:', err);
        res.status(500).send('데이터 저장 실패');
    }
});

// 통계 API
app.get('/stats', async (req, res) => {
    try {
        const totalApplications = await Customer.countDocuments();
        const completedConsultations = await Customer.countDocuments({ status: '상담완료' });
        const completedReservations = await Customer.countDocuments({ status: '예약완료' });

        const initialApplications = 8728;
        const initialConsultations = 8714;
        const initialReservations = 8234;

        res.json({
            totalApplications: totalApplications + initialApplications,
            completedConsultations: completedConsultations + initialConsultations,
            completedReservations: completedReservations + initialReservations,
        });
    } catch (err) {
        console.error('통계 데이터를 가져오는 중 오류 발생:', err);
        res.status(500).send('통계 데이터를 가져오는 중 오류 발생');
    }
});

// 고객 데이터 가져오기
app.get('/customers', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const totalCustomers = await Customer.countDocuments();
        const customers = await Customer.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            totalCustomers,
            customers,
            totalPages: Math.ceil(totalCustomers / limit),
            currentPage: page,
        });
    } catch (err) {
        console.error('데이터 가져오기 실패:', err);
        res.status(500).send('데이터 가져오기 실패');
    }
});

// 상태 변경 API
app.put('/update-status/:id', async (req, res) => {
    try {
        const customerId = req.params.id;
        const { status } = req.body;

        console.log(`요청된 ID: ${customerId}, 새로운 상태: ${status}`);

        if (!status) {
            console.error('상태가 제공되지 않음');
            return res.status(400).send({ error: '상태가 제공되지 않았습니다.' });
        }

        const updatedCustomer = await Customer.findByIdAndUpdate(
            customerId,
            { status },
            { new: true }
        );

        if (!updatedCustomer) {
            console.error(`고객 ID ${customerId}를 찾을 수 없음`);
            return res.status(404).send({ error: '해당 고객을 찾을 수 없습니다.' });
        }

        console.log(`고객 ID ${customerId}의 상태가 ${status}로 업데이트되었습니다.`);
        res.send(updatedCustomer);
    } catch (err) {
        console.error('상태 업데이트 중 오류:', err);
        res.status(500).send({ error: '상태 업데이트 실패' });
    }
});

// 고객 번호 업데이트 (한 번만 실행)
app.get('/update-customer-numbers', async (req, res) => {
    try {
        const customers = await Customer.find().sort({ createdAt: 1 });
        let nextCustomerNumber = 12346;

        for (const customer of customers) {
            customer.customerNumber = nextCustomerNumber;
            await customer.save();
            nextCustomerNumber++;
        }

        console.log('고객 번호 업데이트 완료');
        res.send('모든 고객 번호가 성공적으로 업데이트되었습니다.');
    } catch (err) {
        console.error('고객 번호 업데이트 중 오류 발생:', err);
        res.status(500).send('고객 번호 업데이트 실패');
    }
});

// 서버 실행
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
