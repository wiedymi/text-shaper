#include <ft2build.h>
#include FT_FREETYPE_H

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifndef FT_LOAD_TARGET_MASK
#define FT_LOAD_TARGET_MASK (FT_LOAD_TARGET_(0xF))
#endif

static int *parse_glyph_list(const char *list, size_t *out_count) {
	if (!list || !*list) {
		*out_count = 0;
		return NULL;
	}

	size_t count = 1;
	for (const char *p = list; *p; p++) {
		if (*p == ',') count++;
	}

	int *gids = (int *)calloc(count, sizeof(int));
	if (!gids) return NULL;

	char *buffer = strdup(list);
	if (!buffer) {
		free(gids);
		return NULL;
	}

	size_t idx = 0;
	char *save = NULL;
	char *token = strtok_r(buffer, ",", &save);
	while (token && idx < count) {
		gids[idx++] = (int)strtol(token, NULL, 10);
		token = strtok_r(NULL, ",", &save);
	}

	free(buffer);
	*out_count = idx;
	return gids;
}

static int flag_includes(const char *flags, const char *needle) {
	if (!flags || !*flags || !needle || !*needle) return 0;
	return strstr(flags, needle) != NULL;
}

static int parse_csv_doubles(const char *arg, double *out, size_t max) {
	if (!arg || !*arg) return 0;
	char *buffer = strdup(arg);
	if (!buffer) return 0;
	size_t count = 0;
	char *save = NULL;
	char *token = strtok_r(buffer, ",", &save);
	while (token && count < max) {
		out[count++] = strtod(token, NULL);
		token = strtok_r(NULL, ",", &save);
	}
	free(buffer);
	return (int)count;
}

int main(int argc, char **argv) {
	if (argc < 4) {
		fprintf(stderr, "usage: %s <font-path> <pixel-size> <gid-list> [flags] [matrix] [delta]\n", argv[0]);
		return 1;
	}

	const char *font_path = argv[1];
	int pixel_size = atoi(argv[2]);
	const char *gid_list = argv[3];
	const char *flags = argc >= 5 ? argv[4] : NULL;
	const char *matrix_arg = argc >= 6 ? argv[5] : NULL;
	const char *delta_arg = argc >= 7 ? argv[6] : NULL;

	FT_Render_Mode render_mode = FT_RENDER_MODE_NORMAL;
	FT_Int32 load_flags =
		FT_LOAD_DEFAULT | FT_LOAD_NO_AUTOHINT | FT_LOAD_NO_BITMAP;
	if (flag_includes(flags, "nohint")) {
		load_flags |= FT_LOAD_NO_HINTING;
	}
	if (flag_includes(flags, "light")) {
		load_flags &= ~FT_LOAD_TARGET_MASK;
		load_flags |= FT_LOAD_TARGET_LIGHT;
	}
	if (flag_includes(flags, "mono")) {
		load_flags &= ~FT_LOAD_TARGET_MASK;
		load_flags |= FT_LOAD_TARGET_MONO;
		render_mode = FT_RENDER_MODE_MONO;
	}

	FT_Library library;
	FT_Face face;

	if (FT_Init_FreeType(&library)) {
		fprintf(stderr, "failed to init freetype\n");
		return 1;
	}

	if (FT_New_Face(library, font_path, 0, &face)) {
		fprintf(stderr, "failed to load font: %s\n", font_path);
		FT_Done_FreeType(library);
		return 1;
	}

	if (FT_Set_Pixel_Sizes(face, 0, (FT_UInt)pixel_size)) {
		fprintf(stderr, "failed to set pixel size\n");
		FT_Done_Face(face);
		FT_Done_FreeType(library);
		return 1;
	}

	size_t gid_count = 0;
	int *gids = parse_glyph_list(gid_list, &gid_count);
	if (!gids || gid_count == 0) {
		fprintf(stderr, "empty glyph list\n");
		FT_Done_Face(face);
		FT_Done_FreeType(library);
		free(gids);
		return 1;
	}

	printf("[");
	for (size_t i = 0; i < gid_count; i++) {
		FT_UInt gid = (FT_UInt)gids[i];
		if (i > 0) printf(",");
		FT_Matrix matrix;
		FT_Vector delta;
		int apply_transform = 0;

		if (matrix_arg && *matrix_arg) {
			double mvals[6] = {0};
			int count = parse_csv_doubles(matrix_arg, mvals, 6);
			if (count >= 4) {
				matrix.xx = (FT_Fixed)(mvals[0] * 65536.0);
				matrix.yx = (FT_Fixed)(mvals[1] * 65536.0);
				matrix.xy = (FT_Fixed)(mvals[2] * 65536.0);
				matrix.yy = (FT_Fixed)(mvals[3] * 65536.0);
				double tx = count >= 6 ? mvals[4] : 0.0;
				double ty = count >= 6 ? mvals[5] : 0.0;
				delta.x = (FT_Pos)(tx * 64.0);
				delta.y = (FT_Pos)(ty * 64.0);
				apply_transform = 1;
			}
		}

		if (delta_arg && *delta_arg) {
			double dvals[2] = {0};
			int count = parse_csv_doubles(delta_arg, dvals, 2);
			if (count >= 2) {
				if (!apply_transform) {
					matrix.xx = 1 << 16;
					matrix.xy = 0;
					matrix.yx = 0;
					matrix.yy = 1 << 16;
					delta.x = 0;
					delta.y = 0;
					apply_transform = 1;
				}
				delta.x += (FT_Pos)dvals[0];
				delta.y += (FT_Pos)dvals[1];
			}
		}

		if (apply_transform)
			FT_Set_Transform(face, &matrix, &delta);
		else
			FT_Set_Transform(face, NULL, NULL);

		FT_Error load_err =
			FT_Load_Glyph(face, gid, load_flags);
		FT_Error render_err = 0;
		if (!load_err) {
			render_err = FT_Render_Glyph(face->glyph, render_mode);
		}

		if (load_err || render_err) {
			if (apply_transform) FT_Set_Transform(face, NULL, NULL);
			printf("{\"gid\":%u,\"width\":0,\"rows\":0,\"left\":0,\"top\":0,\"advanceX\":0}",
				gid);
			continue;
		}

		FT_GlyphSlot slot = face->glyph;
		FT_Bitmap *bitmap = &slot->bitmap;
		int left = slot->bitmap_left;
		int top = slot->bitmap_top;

		printf(
			"{\"gid\":%u,\"width\":%u,\"rows\":%u,\"left\":%d,\"top\":%d,\"advanceX\":%ld",
			gid,
			bitmap->width,
			bitmap->rows,
			left,
			top,
			(long)(slot->advance.x >> 6)
		);
		if (flag_includes(flags, "pixels") && bitmap->buffer) {
			printf(",\"pixels\":[");
			unsigned int width = bitmap->width;
			unsigned int rows = bitmap->rows;
			int pitch = bitmap->pitch;
			int abs_pitch = pitch < 0 ? -pitch : pitch;
			int origin = pitch < 0 ? (rows - 1) * abs_pitch : 0;
			unsigned int idx = 0;
			for (unsigned int y = 0; y < rows; y++) {
				int row = origin + (int)y * pitch;
				for (unsigned int x = 0; x < width; x++) {
					if (idx > 0) printf(",");
					printf("%u", bitmap->buffer[row + (int)x]);
					idx++;
				}
			}
			printf("]");
		}
		printf("}");

		if (apply_transform) FT_Set_Transform(face, NULL, NULL);
	}
	printf("]\n");

	free(gids);
	FT_Done_Face(face);
	FT_Done_FreeType(library);
	return 0;
}
