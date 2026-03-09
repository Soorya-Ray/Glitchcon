import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../models/auth_models.dart';
import '../models/order_models.dart';

class ApiClient {
  ApiClient({String? baseUrl})
      : _dio = Dio(BaseOptions(
          baseUrl: baseUrl ?? 'http://10.0.2.2:3000/api/v1',
          headers: {'Content-Type': 'application/json'},
        )) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _storage.read(key: _tokenKey);
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
      ),
    );
  }

  final Dio _dio;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  static const _tokenKey = 'escrow_token';

  dynamic _unwrap(Response response) {
    final body = response.data as Map<String, dynamic>;
    if (body['success'] != true) {
      throw Exception(body['error'] ?? 'Request failed');
    }
    return body['data'];
  }

  Future<LoginResponse> login(String username, String password) async {
    final res = await _dio.post('/auth/login', data: {
      'username': username,
      'password': password,
    });
    final payload = _unwrap(res) as Map<String, dynamic>;
    final login = LoginResponse.fromJson(payload);
    await _storage.write(key: _tokenKey, value: login.token);
    return login;
  }

  Future<void> logout() async {
    try {
      await _dio.post('/auth/logout');
    } finally {
      await _storage.delete(key: _tokenKey);
    }
  }

  Future<AuthUser> me() async {
    final res = await _dio.get('/auth/me');
    return AuthUser.fromJson(_unwrap(res) as Map<String, dynamic>);
  }

  Future<List<EscrowOrder>> getOrders() async {
    final res = await _dio.get('/orders');
    final list = _unwrap(res) as List<dynamic>;
    return list
        .map((e) => EscrowOrder.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<EscrowOrder> createOrder({
    required String supplierId,
    required double amount,
    required String description,
    required String pickupAddress,
    required String deliveryAddress,
  }) async {
    final res = await _dio.post('/orders', data: {
      'supplierId': supplierId,
      'amount': amount,
      'description': description,
      'pickupAddress': pickupAddress,
      'deliveryAddress': deliveryAddress,
    });
    final data = _unwrap(res) as Map<String, dynamic>;
    final order = data['order'] as Map<String, dynamic>;
    return EscrowOrder.fromJson(order);
  }

  Future<PaymentIntentPayload> createPaymentIntent(String orderId, double amount) async {
    final res = await _dio.post('/payments/create-intent', data: {
      'orderId': orderId,
      'amount': amount,
    });
    return PaymentIntentPayload.fromJson(_unwrap(res) as Map<String, dynamic>);
  }

  Future<EscrowOrder> payOrder(String orderId, String paymentIntentId) async {
    final res = await _dio.post('/orders/$orderId/pay', data: {
      'paymentIntentId': paymentIntentId,
    });
    return EscrowOrder.fromJson(_unwrap(res) as Map<String, dynamic>);
  }

  Future<EscrowOrder> assignDriver(String orderId, String driverId) async {
    final res = await _dio.post('/orders/$orderId/assign', data: {'driverId': driverId});
    return EscrowOrder.fromJson(_unwrap(res) as Map<String, dynamic>);
  }

  Future<EscrowOrder> submitProof({
    required String orderId,
    required double gpsLat,
    required double gpsLng,
    String? notes,
    File? image,
  }) async {
    final formData = FormData.fromMap({
      'gpsLat': gpsLat,
      'gpsLng': gpsLng,
      'notes': notes ?? '',
      if (image != null)
        'image': await MultipartFile.fromFile(image.path, filename: image.uri.pathSegments.last),
    });

    final res = await _dio.post('/orders/$orderId/proof', data: formData);
    return EscrowOrder.fromJson(_unwrap(res) as Map<String, dynamic>);
  }

  Future<EscrowOrder> confirmDelivery(String orderId) async {
    final res = await _dio.post('/orders/$orderId/confirm');
    return EscrowOrder.fromJson(_unwrap(res) as Map<String, dynamic>);
  }

  Future<EscrowOrder> raiseDispute(String orderId, String reason) async {
    final res = await _dio.post('/orders/$orderId/dispute', data: {'reason': reason});
    return EscrowOrder.fromJson(_unwrap(res) as Map<String, dynamic>);
  }

  Future<EscrowOrder> resolveDispute(String orderId, String decision, {double? amount}) async {
    final res = await _dio.post('/orders/$orderId/resolve', data: {
      'decision': decision,
      'amount': amount,
    });
    return EscrowOrder.fromJson(_unwrap(res) as Map<String, dynamic>);
  }
}
