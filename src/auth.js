// src/auth.js
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "select_account",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
    GitHub({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
    Credentials({
      name: "Credenciales",
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Buscar usuario en Aiven MySQL
        const [rows] = await db.query("SELECT * FROM usuarios WHERE email = ?", [credentials.email]);
        const user = rows[0];

        if (!user || !user.password_hash) return null;

        // Validar contraseña encriptada
        const passwordMatch = await bcrypt.compare(credentials.password, user.password_hash);
        if (!passwordMatch) return null;

        return { id: user.id.toString(), name: user.nombre, email: user.email, image: user.imagen_url };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Registro automático para usuarios de Google y GitHub
      if (account?.provider === "google" || account?.provider === "github") {
        try {
          const [existingUsers] = await db.query("SELECT * FROM usuarios WHERE email = ?", [user.email]);

          if (existingUsers.length === 0) {
            await db.query(
              "INSERT INTO usuarios (nombre, email, imagen_url, proveedor) VALUES (?, ?, ?, ?)",
              [user.name, user.email, user.image, account.provider]
            );
          }
        } catch (error) {
          console.error("Error al guardar usuario OAuth:", error);
          return false;
        }
      }
      return true;
    },
    async session({ session }) {
      if (session?.user?.email) {
        const [rows] = await db.query("SELECT id FROM usuarios WHERE email = ?", [session.user.email]);
        if (rows[0]) {
          session.user.id = rows[0].id;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});