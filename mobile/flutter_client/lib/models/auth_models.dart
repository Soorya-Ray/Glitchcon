class AuthUser {
  final String id;
  final String username;
  final String name;
  final String role;
  final String? email;

  AuthUser({
    required this.id,
    required this.username,
    required this.name,
    required this.role,
    this.email,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id'] as String,
      username: json['username'] as String,
      name: json['name'] as String,
      role: json['role'] as String,
      email: json['email'] as String?,
    );
  }
}

class LoginResponse {
  final String token;
  final AuthUser user;

  LoginResponse({required this.token, required this.user});

  factory LoginResponse.fromJson(Map<String, dynamic> json) {
    return LoginResponse(
      token: json['token'] as String,
      user: AuthUser.fromJson(json['user'] as Map<String, dynamic>),
    );
  }
}
