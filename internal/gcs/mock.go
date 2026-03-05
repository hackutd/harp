package gcs

import (
	"context"

	"github.com/stretchr/testify/mock"
)

type MockClient struct {
	mock.Mock
}

func (m *MockClient) GenerateUploadURL(_ context.Context, objectPath string) (string, error) {
	args := m.Called(objectPath)
	return args.String(0), args.Error(1)
}

func (m *MockClient) GenerateDownloadURL(_ context.Context, objectPath string) (string, error) {
	args := m.Called(objectPath)
	return args.String(0), args.Error(1)
}

func (m *MockClient) DeleteObject(_ context.Context, objectPath string) error {
	args := m.Called(objectPath)
	return args.Error(0)
}
