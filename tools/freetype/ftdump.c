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

int main(int argc, char **argv) {
	if (argc < 4) {
		fprintf(stderr, "usage: %s <font-path> <pixel-size> <gid-list> [flags]\n", argv[0]);
		return 1;
	}

	const char *font_path = argv[1];
	int pixel_size = atoi(argv[2]);
	const char *gid_list = argv[3];
	const char *flags = argc >= 5 ? argv[4] : NULL;

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
		FT_Error load_err =
			FT_Load_Glyph(face, gid, load_flags);
		FT_Error render_err = 0;
		if (!load_err) {
			render_err = FT_Render_Glyph(face->glyph, render_mode);
		}

		if (i > 0) printf(",");
		if (load_err || render_err) {
			printf("{\"gid\":%u,\"width\":0,\"rows\":0,\"left\":0,\"top\":0,\"advanceX\":0}",
				gid);
			continue;
		}

		FT_GlyphSlot slot = face->glyph;
		printf(
			"{\"gid\":%u,\"width\":%u,\"rows\":%u,\"left\":%d,\"top\":%d,\"advanceX\":%ld",
			gid,
			slot->bitmap.width,
			slot->bitmap.rows,
			slot->bitmap_left,
			slot->bitmap_top,
			(long)(slot->advance.x >> 6)
		);
		if (flag_includes(flags, "pixels") && slot->bitmap.buffer) {
			printf(",\"pixels\":[");
			unsigned int total = slot->bitmap.width * slot->bitmap.rows;
			for (unsigned int p = 0; p < total; p++) {
				if (p > 0) printf(",");
				printf("%u", slot->bitmap.buffer[p]);
			}
			printf("]");
		}
		printf("}");
	}
	printf("]\n");

	free(gids);
	FT_Done_Face(face);
	FT_Done_FreeType(library);
	return 0;
}
