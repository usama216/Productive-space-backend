

const express=require("express")
const { createPayment, handleWebhook }=require("../controllers/payment")

const router = express.Router();
router.post("/create-payment", createPayment);
router.post("/webhook", handleWebhook);

module.exports= router;
