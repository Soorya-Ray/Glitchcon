class EscrowOrder {
  final String orderId;
  final String customerId;
  final String supplierId;
  final String? driverId;
  final String status;
  final double amount;
  final String? description;

  EscrowOrder({
    required this.orderId,
    required this.customerId,
    required this.supplierId,
    this.driverId,
    required this.status,
    required this.amount,
    this.description,
  });

  factory EscrowOrder.fromJson(Map<String, dynamic> json) {
    return EscrowOrder(
      orderId: json['orderId'] as String,
      customerId: json['customerId'] as String,
      supplierId: json['supplierId'] as String,
      driverId: json['driverId'] as String?,
      status: json['status'] as String,
      amount: (json['amount'] as num).toDouble(),
      description: json['description'] as String?,
    );
  }
}

class PaymentIntentPayload {
  final String paymentIntentId;
  final String clientSecret;
  final String status;

  PaymentIntentPayload({
    required this.paymentIntentId,
    required this.clientSecret,
    required this.status,
  });

  factory PaymentIntentPayload.fromJson(Map<String, dynamic> json) {
    return PaymentIntentPayload(
      paymentIntentId: json['paymentIntentId'] as String,
      clientSecret: json['clientSecret'] as String,
      status: json['status'] as String,
    );
  }
}
