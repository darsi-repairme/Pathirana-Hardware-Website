import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ENV, type Env } from "../config/env";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { StaffAuthGuard } from "./staff-auth.guard";

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        secret: env.JWT_SECRET,
        signOptions: {
          algorithm: "HS256",
          expiresIn: env.JWT_EXPIRES_IN as "8h",
          issuer: "pathirana-web-api",
          audience: "pathirana-staff",
        },
        verifyOptions: { algorithms: ["HS256"], issuer: "pathirana-web-api", audience: "pathirana-staff" },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, StaffAuthGuard],
  exports: [AuthService, StaffAuthGuard],
})
export class AuthModule {}
